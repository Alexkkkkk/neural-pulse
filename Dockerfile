# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Устанавливаем системные зависимости для сборки нативных модулей (sqlite3)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости и пересобираем sqlite3 под архитектуру контейнера
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Устанавливаем tini и необходимые библиотеки для работы sqlite3
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем скомпилированные модули из сборщика
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходный код приложения
COPY . .

# Устанавливаем PM2 глобально (используем более легкий метод)
RUN npm install -g pm2 && npm cache clean --force

# Создаем директории и ПЕРЕДАЕМ ПРАВА пользователю node
# Это жизненно важно для Webhook-бота, чтобы логи и БД писались без ошибок
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs /app

# Настройки среды
ENV NODE_ENV=production
ENV PORT=3000
# Переменная для нашего Webhook (подхватится сервером)
ENV WEB_APP_URL=https://np.bothost.ru

EXPOSE 3000

# Используем tini для правильной передачи сигналов остановки (SIGTERM) нашему серверу
ENTRYPOINT ["/sbin/tini", "--"]

# Работаем от имени пользователя node для безопасности
USER node

# Запуск через PM2
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
