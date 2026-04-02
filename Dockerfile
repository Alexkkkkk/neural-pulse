# === STAGE 1: BUILDER (Сборка) ===
FROM node:20-slim AS builder

# Установка системных зависимостей для сборки бинарных модулей
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Настройки памяти для тяжелой сборки AdminJS
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Установка зависимостей
COPY package*.json ./
RUN npm ci

# Копируем все исходники (включая папку static с твоим дизайном)
COPY . .

# Предсборка AdminJS с логированием времени в реальном времени
RUN echo "import AdminJS, { ComponentLoader } from 'adminjs'; \
async function build() { \
  const now = () => new Date().toLocaleTimeString(); \
  console.log(\`--- ⚡ [\${now()}] NEURAL PULSE: START BUNDLING ---\`); \
  const componentLoader = new ComponentLoader(); \
  const admin = new AdminJS({ \
    rootPath: '/admin', \
    componentLoader, \
    resources: [], \
    bundler: { minify: true, force: true } \
  }); \
  await admin.initialize(); \
  console.log(\`--- ✅ [\${now()}] ADMINJS BUNDLE READY ---\`); \
  process.exit(0); \
} \
build().catch(err => { console.error(err); process.exit(1); });" > build-admin.js && \
node build-admin.js

# Удаляем dev-зависимости перед финальной стадией
RUN npm prune --production


# === STAGE 2: RUNNER (Работа) ===
FROM node:20-slim

# dumb-init для управления процессами и curl для healthcheck
RUN apt-get update && apt-get install -y dumb-init curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Настройки для сервера с лимитом 2GB RAM
ENV NODE_ENV=production
# Резервируем 1.5GB под Node.js, остальное — системе и Docker
ENV NODE_OPTIONS="--max-old-space-size=1536 --expose-gc"

# Переносим только собранные и нужные файлы
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs
COPY --from=builder /app/static ./static
COPY --from=builder /app/*.js ./
COPY --from=builder /app/*.json ./

# Гарантируем права доступа для сохранения картинок и сессий
# Права 777 для папок, где бот сохраняет данные (дизайн и логи)
RUN mkdir -p data static/images && \
    chmod -R 777 .adminjs data static/images static/ && \
    chown -R node:node /app

# Работа от безопасного пользователя
USER node

# Мониторинг "живости" сервиса в реальном времени
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Запуск с принудительным сборщиком мусора для экономии памяти
CMD ["node", "--expose-gc", "server.js"]
