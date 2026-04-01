# === STAGE 1: BUILDER (Сборка) ===
FROM node:20-slim AS builder

# Установка системных зависимостей для сборки модулей
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Даем 1.5 ГБ для стабильной сборки AdminJS
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Установка зависимостей через ci для стабильности версий
COPY package*.json ./
RUN npm ci

# Копируем проект (учитывая твой .dockerignore)
COPY . .

# Предсборка AdminJS (статический бандл)
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

# Удаляем лишнее для уменьшения размера образа
RUN npm prune --production

# === STAGE 2: RUNNER (Работа) ===
FROM node:20-slim

# dumb-init для корректной работы с сигналами Linux
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Настройки для сервера 2GB RAM
ENV NODE_ENV=production
# Выделяем 1.5 ГБ под Node.js, оставляя запас для системы
ENV NODE_OPTIONS="--max-old-space-size=1536 --expose-gc"

# Копируем только необходимые для запуска файлы
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs

# Копируем статику (твой дизайн, лого и манифест)
COPY --from=builder /app/static ./static

# Копируем JS скрипты сервера и ВСЕ JSON конфиги (включая манифест TON)
COPY --from=builder /app/*.js ./
COPY --from=builder /app/*.json ./

# Настройка прав: разрешаем запись в папки данных и картинок
# Это критично для сохранения сессий и твоего дизайна
RUN mkdir -p data static/images && \
    chmod -R 777 .adminjs data static/images static/ && \
    chown -R node:node /app

# Работаем от безопасного пользователя
USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
# Запуск сервера с принудительным сборщиком мусора
CMD ["node", "--expose-gc", "server.js"]
