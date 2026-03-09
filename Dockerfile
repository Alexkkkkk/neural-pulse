# --- ЭТАП 1: Сборка (Build-stage) ---
FROM node:18-alpine AS builder

# Инструменты для сборки нативных модулей (обязательно для sqlite3 на alpine)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev

WORKDIR /app
COPY package*.json ./

# Устанавливаем зависимости и принудительно собираем sqlite3 из исходников
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source && \
    npm cache clean --force

# --- ЭТАП 2: Финальный образ (Runtime-stage) ---
FROM node:18-alpine

# libstdc++ необходим для работы скомпилированных бинарников sqlite3
# tini обеспечивает корректную обработку сигналов завершения (SIGTERM/SIGINT)
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем зависимости из builder-слоя
COPY --from=builder /app/node_modules ./node_modules
# Копируем остальной код проекта
COPY . .

# Подготовка структуры папок и прав доступа
# Мы создаем папки заранее, чтобы USER node мог в них писать
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs && \
    chmod -R 755 /app/data /app/logs

# Настройки окружения для работы в продакшене
ENV NODE_ENV=production
ENV PORT=3000
# Лимит памяти для предотвращения падения контейнера по OOM
ENV NODE_OPTIONS="--max-old-space-size=1024 --no-warnings"

EXPOSE 3000

# Устанавливаем PM2 для управления процессом
RUN npm install -g pm2 && npm cache clean --force

# Универсальный Healthcheck: проверяет, что сервер вообще отвечает по HTTP
# Это критично на Bothost для автоматического перезапуска при зависании
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {if(r.statusCode >= 400)process.exit(1)})" || exit 1

# Используем tini как инициализатор процесса (правильно пробрасывает сигналы в PM2)
ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на непривилегированного пользователя для безопасности
USER node

# Запуск проекта через PM2 Runtime
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
