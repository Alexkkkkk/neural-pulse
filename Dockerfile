# === STAGE 1: BUILDER (Сборка) ===
FROM node:20-slim AS builder

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# На этапе сборки даем 1.5 ГБ, чтобы AdminJS собрался без ошибок
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=1536"

COPY package*.json ./
RUN npm ci

COPY . .

# Предсборка AdminJS (твой проверенный скрипт)
RUN echo "import AdminJS, { ComponentLoader } from 'adminjs'; \
import path from 'path'; \
import fs from 'fs'; \
async function build() { \
  console.log('--- ⚡ NEURAL PULSE: BUNDLING DASHBOARD ---'); \
  const componentLoader = new ComponentLoader(); \
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

# Очистка от лишних модулей
RUN npm prune --production

# === STAGE 2: RUNNER (Работа) ===
FROM node:20-slim

RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
# Увеличиваем лимит до 1.5 ГБ (из доступных 2 ГБ), чтобы боту было комфортно
ENV NODE_OPTIONS="--max-old-space-size=1536 --expose-gc"

# Копируем модули и настройки
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs

# Копируем статику (дизайн, картинки, манифесты)
COPY --from=builder /app/static ./static

# Копируем ВСЕ JS и JSON файлы (важно для работы tonconnect-manifest.json и конфигов)
COPY --from=builder /app/*.js ./
COPY --from=builder /app/*.json ./

# Настройка прав (полный доступ к папкам данных и картинок)
RUN mkdir -p data static/images && \
    chmod -R 777 .adminjs data static/images static/ && \
    chown -R node:node /app

# Безопасный запуск
USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
# Запуск с принудительным сборщиком мусора
CMD ["node", "--expose-gc", "server.js"]
