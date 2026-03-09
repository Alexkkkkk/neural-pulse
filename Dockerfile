# --- ЭТАП 1: Сборка (Build-stage) ---
FROM node:18-alpine AS builder

# Инструменты для сборки нативных модулей (обязательно для sqlite3 на alpine)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev

WORKDIR /app
COPY package*.json ./

# Устанавливаем зависимости и собираем sqlite3 под текущую архитектуру
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source && \
    npm cache clean --force

# --- ЭТАП 2: Финальный образ (Runtime-stage) ---
FROM node:18-alpine

# libstdc++ нужен для работы скомпилированного sqlite3, tini для обработки сигналов
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только необходимые модули из билдера
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем папки и выставляем права. 
# ВАЖНО: папка /app/data должна быть примонтирована как Volume на Bothost
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs

# Настройки окружения
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=1024 --no-warnings"

EXPOSE 3000

# Устанавливаем PM2 глобально
RUN npm install -g pm2 && npm cache clean --force

# ИСПРАВЛЕННЫЙ Healthcheck: проверяем просто доступность сервера по HTTP
# Это предотвратит ложные перезагрузки, если API эндпоинты изменятся
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {if(r.statusCode >= 400)process.exit(1)})" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на пользователя node для безопасности
USER node

# Запуск через PM2. Убедись, что файл ecosystem.config.js есть в репозитории!
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
