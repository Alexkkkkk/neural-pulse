# === STAGE 1: BUILDER (Тяжелая артиллерия) ===
FROM node:20-slim AS builder

# 1. Системные зависимости для компиляции SQLite/Native модулей
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Оптимизация памяти для Node.js (V8) во время сборки
# Даем 2ГБ, чтобы AdminJS/Babel не падал по OOM на этапе бандлинга
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# 3. Кэширование слоев зависимостей
COPY package*.json ./
RUN npm install --include=dev && npm cache clean --force

# 4. Копируем исходный код
COPY . .

# 5. --- [МАГИЯ ПРЕДСБОРКИ АДМИНКИ] ---
# Исправлено: Добавлен Mock для БД, чтобы скрипт инициализации AdminJS не пытался 
# подключиться к базе, которой еще нет в Docker-контейнере.
RUN mkdir -p .adminjs static/.adminjs && \
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
  /* Создаем инстанс AdminJS специально для сборки статики */ \
  const admin = new AdminJS({ \
    rootPath: '/admin', \
    componentLoader, \
    resources: [], \
    bundler: { \
      minify: true, \
      force: true \
    } \
  }); \
  await admin.initialize(); \
  console.log('--- ✅ BUNDLE SEALED & OPTIMIZED ---'); \
  process.exit(0); \
} \
build().catch(err => { console.error('❌ BUILD ERROR:', err); process.exit(1); });"

# 6. Очистка от лишних dev-пакетов перед финальным этапом
RUN npm prune --production


# === STAGE 2: RUNNER (Легкий и быстрый) ===
FROM node:20-slim

# 7. Установка dumb-init (Критично для Node.js в Docker)
# Это гарантирует, что SIGTERM от Bothost корректно убьет и server.js, и bot.js.
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 8. Переменные окружения среды исполнения
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
# В рантайме память ограничиваем, чтобы не забирать лишнего у хостинга
ENV NODE_OPTIONS="--max-old-space-size=512"

# 9. Копируем ТОЛЬКО необходимые файлы (Zero-Waste)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs
COPY --from=builder /app/static ./static
COPY --from=builder /app/*.js ./

# 10. ФИНАЛЬНЫЕ ПРАВА ДОСТУПА
# Создаем папки и даем права 777, чтобы SQLite и AdminJS могли писать файлы 
# независимо от того, под каким пользователем запустит контейнер Bothost.
RUN mkdir -p data static/images && \
    chmod -R 777 data .adminjs static/images static/.adminjs

# 11. Порт 3000 — точка входа для Nginx прокси
EXPOSE 3000

# 12. Сверхнадежный запуск
# dumb-init принимает сигналы завершения и передает их всем дочерним процессам
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
