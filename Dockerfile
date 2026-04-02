# === STAGE 1: BUILDER (Сборка) ===
FROM node:20-slim AS builder

# Установка системных зависимостей для сборки бинарных модулей (необходимы для некоторых npm пакетов)
RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Настройки памяти для тяжелой сборки AdminJS (очень важно для Node.js 20)
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Установка зависимостей (используем ci для стабильности версии)
COPY package*.json ./
RUN npm ci --no-audit

# Копируем исходники (папка static с твоим дизайном копируется здесь)
COPY . .

# Предсборка AdminJS. Скрипт генерирует бандл UI заранее, чтобы бот не тормозил при старте.
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
node build-admin.js && rm build-admin.js

# Удаляем dev-зависимости, оставляем только продакшн для легкости образа
RUN npm prune --production


# === STAGE 2: RUNNER (Работа) ===
FROM node:20-slim

# dumb-init защищает от "зомби-процессов", curl нужен для проверки здоровья бота в панели
RUN apt-get update && apt-get install -y dumb-init curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Настройки для сервера с лимитом 2GB RAM. 
# Оставляем 1.5GB для Node, чтобы Docker и система не "задохнулись".
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1536 --expose-gc"

# Переносим только результат сборки
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.adminjs ./.adminjs
COPY --from=builder /app/static ./static
COPY --from=builder /app/*.js ./
COPY --from=builder /app/*.json ./

# Создаем нужные папки и выставляем права 777. 
# Это гарантирует, что твой дизайн (static/images) и данные (data) будут доступны для записи.
RUN mkdir -p data static/images && \
    chmod -R 777 .adminjs data static/images static/ && \
    chown -R node:node /app

# Переключаемся на безопасного пользователя 'node'
USER node

# Проверка, что сервер отвечает на порту 3000. Если упадет — Bothost это увидит.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

EXPOSE 3000

# Используем dumb-init как точку входа
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Запуск. Флаг --expose-gc позволяет боту принудительно очищать память, если она забита.
CMD ["node", "--expose-gc", "server.js"]
