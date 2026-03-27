# === STAGE 1: BUILDER ===
FROM node:20-slim AS builder

# Системные зависимости для сборки нативных модулей (pg, hstore)
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# На этапе сборки нам нужны все зависимости
ENV NODE_ENV=development
# Ограничиваем билд, чтобы не вылететь за лимиты хостинга
ENV NODE_OPTIONS="--max-old-space-size=1536"

COPY package*.json ./
RUN npm install && npm cache clean --force

COPY . .

# МАГИЯ ПРЕДСБОРКИ: Генерируем статический бандл AdminJS
# Мы выносим код в файл build-admin.js, чтобы избежать проблем с кавычками в shell
RUN printf "import AdminJS, { ComponentLoader } from 'adminjs'; \
import path from 'path'; \
import fs from 'fs'; \
async function build() { \
  console.log('--- ⚡ NEURAL PULSE: BUNDLING DASHBOARD ---'); \
  const componentLoader = new ComponentLoader(); \
  const dashPath = path.join(process.cwd(), 'static', 'dashboard.jsx'); \
  if (fs.existsSync(dashPath)) componentLoader.add('Dashboard', dashPath); \
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

# Удаляем dev-зависимости перед финальной сборкой
RUN npm prune --production

# === STAGE 2: RUNNER ===
FROM node:20-slim

RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
# Устанавливаем лимит памяти чуть ниже лимита тарифа (512MB), чтобы Node.js чистил себя сам
# --expose-gc ОБЯЗАТЕЛЕН для работы твоего Memory Guard в server.js
ENV NODE_OPTIONS="--max-old-space-size=450 --expose-gc"

# Копируем артефакты
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs
COPY --from=builder /app/static ./static
COPY --from=builder /app/*.js ./
COPY --from=builder /app/models ./models 2>/dev/null || true

# Права доступа (на Bothost лучше давать 777 на папку данных, если USER не root)
RUN mkdir -p data static/images && \
    chmod -R 777 data .adminjs static/images static/.adminjs && \
    chown -R node:node /app

# Безопасный запуск от пользователя node
USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
# Запускаем через node напрямую с прокидкой флагов
CMD ["node", "--expose-gc", "server.js"]
