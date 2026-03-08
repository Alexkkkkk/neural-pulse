# --- ЭТАП 1: Сборка (Build-stage) ---
FROM node:18-alpine AS builder

# Установка необходимых инструментов для нативной компиляции
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev

WORKDIR /app

# Копируем конфиги зависимостей
COPY package*.json ./

# Чистая установка (ci) быстрее и надежнее для продакшена
# Компилируем sqlite3 и удаляем мусор после сборки
RUN npm ci --include=dev && \
    npm rebuild sqlite3 --build-from-source && \
    npm cache clean --force

# --- ЭТАП 2: Финальный образ (Runtime-stage) ---
FROM node:18-alpine

# Устанавливаем tini (правильный init для Docker) и библиотеки рантайма
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только node_modules и файлы из сборщика
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем папку данных и меняем владельца на системного пользователя 'node'
# Это критично для безопасности при масштабировании
RUN mkdir -p /app/data && chown -R node:node /app/data

# Системные настройки для высокой нагрузки
ENV NODE_ENV=production
# Выделяем 4ГБ RAM, если сервер позволяет (на 20 млн юзеров меньше нельзя)
ENV NODE_OPTIONS="--max-old-space-size=4096 --no-warnings"
# Увеличиваем лимит http-заголовков (защита от больших кук/запросов)
ENV NODE_MAX_HTTP_HEADER_SIZE=16384

# Открываем порт
EXPOSE 3000

# Устанавливаем PM2 глобально
RUN npm install -g pm2 && npm cache clean --force

# Проверка "здоровья" контейнера (Healthcheck)
# Если сервер не ответит за 5 секунд, Docker его перезапустит
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/balance/health', (r) => {if(r.statusCode!==200)process.exit(1)})" || exit 1

# Используем Tini для управления процессами
ENTRYPOINT ["/sbin/tini", "--"]

# Запуск под пользователем node (не root!)
USER node

# Запуск в режиме кластера PM2 (используем все ядра)
# --exp-backoff-restart-delay - умный перезапуск при сбоях
CMD ["pm2-runtime", "server.js", "-i", "max", "--exp-backoff-restart-delay", "100"]
