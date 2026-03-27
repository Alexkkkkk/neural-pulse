# === STAGE 1: BUILDER (Сборка бандла) ===
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

COPY package*.json ./
# Устанавливаем всё для компиляции JSX
RUN npm install --include=dev && npm cache clean --force

COPY . .

# Предсборка админки (Магия бандлинга)
RUN mkdir -p .adminjs static/.adminjs static/images && \
    node -e " \
import AdminJS, { ComponentLoader } from 'adminjs'; \
import path from 'path'; \
import fs from 'fs'; \
async function build() { \
  console.log('--- ⚡ NEURAL PULSE: TOTAL BUNDLING INITIATED ---'); \
  const componentLoader = new ComponentLoader(); \
  const dashPath = path.join(process.cwd(), 'static', 'dashboard.jsx'); \
  if (fs.existsSync(dashPath)) { \
    componentLoader.add('Dashboard', dashPath); \
    console.log('✅ Dashboard detected.'); \
  } \
  const admin = new AdminJS({ \
    rootPath: '/admin', \
    componentLoader, \
    resources: [], \
    bundler: { minify: true, force: true } \
  }); \
  await admin.initialize(); \
  console.log('--- ✅ BUNDLE SEALED & OPTIMIZED ---'); \
  process.exit(0); \
} \
build().catch(err => { console.error('❌ BUILD ERROR:', err); process.exit(1); });"

# Удаляем лишние зависимости после сборки
RUN npm prune --production

# === STAGE 2: RUNNER (Легкий образ для работы) ===
FROM node:20-slim

RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
# Чуть расширим память для стабильности монолита
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Копируем только нужное
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs
COPY --from=builder /app/static ./static
# Копируем папку моделей, если она не пустая
COPY --from=builder /app/models ./models 
COPY --from=builder /app/*.js ./

# Права доступа
RUN mkdir -p data static/images && \
    chmod -R 777 data .adminjs static/images static/.adminjs

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
# Запуск нашего единственного файла
CMD ["node", "server.js"]
