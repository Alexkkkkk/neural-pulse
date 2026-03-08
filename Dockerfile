# --- ЭТАП 1: Сборка (Build-stage) ---
FROM node:18-alpine AS builder

# Инструменты для сборки нативных модулей (sqlite3)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev

WORKDIR /app
COPY package*.json ./

# Устанавливаем всё и собираем бинарник sqlite3 специально под Alpine
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source && \
    npm cache clean --force

# --- ЭТАП 2: Финальный образ (Runtime-stage) ---
FROM node:18-alpine

RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем зависимости и код
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Права доступа (обязательно для записи в sqlite)
RUN mkdir -p /app/data && chown -R node:node /app/data

# Настройки окружения
ENV NODE_ENV=production
# Подстраиваем под реальные ресурсы (лучше оставить 1-2ГБ для начала)
ENV NODE_OPTIONS="--max-old-space-size=1024 --no-warnings"
ENV NODE_MAX_HTTP_HEADER_SIZE=16384

EXPOSE 3000

# Устанавливаем PM2
RUN npm install -g pm2 && npm cache clean --force

# Healthcheck: стучимся в корень (который точно отдает 200)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {if(r.statusCode!==200)process.exit(1)})" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]

USER node

# Запуск: 1 процесс для стабильности SQLite + PM2 для автоперезагрузки
# Если в будущем перейдешь на PostgreSQL - тогда ставь "-i max"
CMD ["pm2-runtime", "server.js", "-i", "1", "--exp-backoff-restart-delay", "100"]
