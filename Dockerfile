# === STAGE 1: BUILDER ===
FROM node:20-slim AS builder

# Установка системных зависимостей для сборки нативных модулей (pg, hstore и др.)
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Для сборки бандла AdminJS часто требуются devDependencies
ENV NODE_ENV=development
# Увеличиваем лимит памяти, чтобы Babel не "упал" при компиляции JSX
ENV NODE_OPTIONS="--max-old-space-size=2048"

COPY package*.json ./
# Устанавливаем все зависимости
RUN npm install && npm cache clean --force

COPY . .

# МАГИЯ ПРЕДСБОРКИ: Генерируем статический бандл AdminJS
# Это исключает нагрузку на CPU/RAM при каждом перезапуске контейнера
RUN mkdir -p .adminjs static/.adminjs static/images && \
    node -e " \
import AdminJS, { ComponentLoader } from 'adminjs'; \
import path from 'path'; \
import fs from 'fs'; \
async function build() { \
  console.log('--- ⚡ NEURAL PULSE: BUNDLING DASHBOARD ---'); \
  const componentLoader = new ComponentLoader(); \
  const dashPath = path.join(process.cwd(), 'static', 'dashboard.jsx'); \
  if (fs.existsSync(dashPath)) { \
    componentLoader.add('Dashboard', dashPath); \
    console.log('✅ Dashboard.jsx linked.'); \
  } else { \
    console.warn('⚠️ Dashboard.jsx not found at ' + dashPath); \
  } \
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
build().catch(err => { console.error('❌ BUILD ERROR:', err); process.exit(1); });"

# Удаляем devDependencies перед переходом во второй этап
RUN npm prune --production

# === STAGE 2: RUNNER ===
FROM node:20-slim

# dumb-init необходим для корректной работы Node.js в Docker (обработка сигналов)
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Копируем только необходимые файлы из билдера
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs
COPY --from=builder /app/static ./static
# Копируем основные скрипты (server.js, db.js, logger.js)
COPY --from=builder /app/*.js ./
# Копируем папку моделей, если она есть
COPY --from=builder /app/models ./models 2>/dev/null || true

# Создаем нужные папки и выставляем права для записи (сессии, логи, аватары)
RUN mkdir -p data static/images && \
    chmod -R 777 data .adminjs static/images static/.adminjs

EXPOSE 3000

# Использование dumb-init предотвращает появление "зомби-процессов"
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
