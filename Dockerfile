# === STAGE 1: BUILDER ===
FROM node:20-slim AS builder

# Установка системных зависимостей для сборки нативных модулей
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
# Увеличиваем лимит памяти для Node.js во время тяжелой сборки бандла
ENV NODE_OPTIONS="--max-old-space-size=2048"

COPY package*.json ./
# Устанавливаем ВСЕ зависимости (включая dev для Babel/JSX)
RUN npm install --include=dev && npm cache clean --force

COPY . .

# МАГИЯ ПРЕДСБОРКИ: Генерируем статический бандл AdminJS
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
    console.warn('⚠️ Dashboard.jsx not found, using default.'); \
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

# Оставляем только продакшн-зависимости для финального образа
RUN npm prune --production

# === STAGE 2: RUNNER ===
FROM node:20-slim

# dumb-init корректно завершает процессы в Docker
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Копируем только результат сборки
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs
COPY --from=builder /app/static ./static
# Копируем все JS файлы (server.js, db.js, logger.js и т.д.)
COPY --from=builder /app/*.js ./
# Копируем папку моделей (если она существует)
COPY --from=builder /app/models ./models 2>/dev/null || true

# Настройка прав (важно для записи сессий и логов)
RUN mkdir -p data static/images && \
    chmod -R 777 data .adminjs static/images static/.adminjs

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
