# === STAGE 1: BUILDER (Сборка тяжелых компонентов) ===
FROM node:20-slim AS builder

# Установка системных зависимостей для сборки бинарных модулей
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Настройки памяти для сборки (используем 1.5GB из доступных 2GB)
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Копируем только манифесты для кэширования слоев
COPY package*.json ./

# Устанавливаем ВСЕ зависимости для сборки бандла
# Если package-lock.json отсутствует, используем npm install
RUN npm install --no-audit || npm ci --no-audit

# Копируем весь проект (включая твой дизайн в static/)
COPY . .

# Предсборка AdminJS: генерируем UI бандл заранее, чтобы сервер не вис при первом входе
RUN echo "import AdminJS from 'adminjs'; \
import { ComponentLoader } from 'adminjs'; \
async function build() { \
  const now = () => new Date().toLocaleTimeString(); \
  console.log('--- ⚡ [' + now() + '] NEURAL PULSE: START BUNDLING ---'); \
  const componentLoader = new ComponentLoader(); \
  const admin = new AdminJS({ \
    rootPath: '/admin', \
    componentLoader, \
    resources: [], \
    bundler: { minify: true, force: true } \
  }); \
  await admin.initialize(); \
  console.log('--- ✅ [' + now() + '] ADMINJS BUNDLE READY ---'); \
  process.exit(0); \
} \
build().catch(err => { console.error(err); process.exit(1); });" > build-admin.js && \
node build-admin.js && rm build-admin.js

# Очищаем dev-зависимости, чтобы уменьшить размер финального образа
RUN npm prune --production


# === STAGE 2: RUNNER (Рабочее окружение) ===
FROM node:20-slim

# dumb-init защищает от "зомби-процессов", curl нужен для HEALTHCHECK
RUN apt-get update && apt-get install -y dumb-init curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Настройки для работы (Оптимизация V8 под лимиты Bothost)
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1536 --expose-gc --turbo-fast-api-calls --optimize-for-size"

# Переносим только необходимые файлы из сборщика
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs
COPY --from=builder /app/static ./static
COPY --from=builder /app/*.js ./
COPY --from=builder /app/*.json ./

# Создаем папки для данных и выставляем полные права для твоего дизайна
RUN mkdir -p data static/images && \
    chmod -R 777 .adminjs data static/images static/ && \
    chown -R node:node /app

# Безопасный запуск от пользователя node (стандарт безопасности Docker)
USER node

# Проверка работоспособности: если сервер не ответит, Bothost перезапустит его автоматически
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

EXPOSE 3000

# Точка входа через dumb-init для стабильности процессов
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Запуск с принудительной очисткой мусора (Garbage Collector)
CMD ["node", "--expose-gc", "server.js"]
