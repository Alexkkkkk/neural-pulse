# === STAGE 1: BUILDER ===
FROM node:20-slim AS builder

# Системные зависимости для сборки нативных модулей
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# На этапе сборки разрешаем больше памяти для компиляции админки
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=1024"

COPY package*.json ./
# Используем ci для более стабильной установки зависимостей
RUN npm ci

COPY . .

# МАГИЯ ПРЕДСБОРКИ: Генерируем статический бандл AdminJS заранее
# Мы создаем временный скрипт для инициализации бандлера
RUN echo "import AdminJS, { ComponentLoader } from 'adminjs'; \
import path from 'path'; \
import fs from 'fs'; \
async function build() { \
  console.log('--- ⚡ NEURAL PULSE: BUNDLING DASHBOARD ---'); \
  const componentLoader = new ComponentLoader(); \
  const dashPath = path.join(process.cwd(), 'static', 'dashboard.jsx'); \
  const admin = new AdminJS({ \
    rootPath: '/admin', \
    componentLoader, \
    resources: [], \
    bundler: { minify: true, force: true } \
  }); \
  await admin.initialize(); \
  console.log('--- ✅ ADMINJS BUNDLE READY ---'); \
  process.exit(0); \
} \
build().catch(err => { console.error(err); process.exit(1); });" > build-admin.js && \
node build-admin.js

# Удаляем dev-зависимости, оставляем только продакшн
RUN npm prune --production

# === STAGE 2: RUNNER ===
FROM node:20-slim

# dumb-init необходим для корректной передачи сигналов завершения (SIGTERM)
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
# КРИТИЧНО: --expose-gc позволяет твоему коду в server.js вызывать global.gc()
# Устанавливаем лимит чуть ниже 159MB, чтобы Node.js был "агрессивнее" в чистке
ENV NODE_OPTIONS="--max-old-space-size=140 --expose-gc"

# Копируем только то, что нужно для работы
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs
COPY --from=builder /app/static ./static
COPY --from=builder /app/*.js ./

# Настройка прав для записи (сессии, картинки, статика админки)
RUN mkdir -p data static/images && \
    chmod -R 777 .adminjs static/images static/ && \
    chown -R node:node /app

# Запуск от не-root пользователя для безопасности
USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
# Запуск через node напрямую с принудительным включением сборщика мусора
CMD ["node", "--expose-gc", "server.js"]
