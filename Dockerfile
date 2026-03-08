# --- ЭТАП 1: Сборка (Build-stage) ---
FROM node:18-alpine AS builder

# Инструменты для сборки нативных модулей (обязательно для sqlite3 на alpine)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev

WORKDIR /app
COPY package*.json ./

# Устанавливаем всё и собираем sqlite3 из исходников под текущую ОС
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source && \
    npm cache clean --force

# --- ЭТАП 2: Финальный образ (Runtime-stage) ---
FROM node:18-alpine

# libstdc++ нужен для работы скомпилированного sqlite3
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем зависимости из билдера и весь остальной код
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем папки для данных и логов, выдаем права пользователю node
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs

# Настройки окружения
ENV NODE_ENV=production
ENV PORT=3000
# Оптимизация памяти
ENV NODE_OPTIONS="--max-old-space-size=1024 --no-warnings"

EXPOSE 3000

# Устанавливаем PM2 глобально
RUN npm install -g pm2 && npm cache clean --force

# Healthcheck: проверка доступности API
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/leaderboard', (r) => {if(r.statusCode!==200)process.exit(1)})" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на безопасного пользователя
USER node

# Запуск через твой конфиг (он уже настроен на 1 инстанс и лимиты памяти)
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
