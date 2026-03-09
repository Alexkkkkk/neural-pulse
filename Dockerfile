# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Инструменты для сборки sqlite3
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Установка всех зависимостей и принудительная пересборка sqlite3 под архитектуру alpine
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Добавляем tini для обработки сигналов завершения и libstdc++ для работы sqlite3
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только готовые модули и файлы проекта
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Настройка прав доступа для папок БД и логов
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app

# Установка PM2
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Используем tini как точку входа
ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на пользователя node для безопасности
USER node

# Запускаем через PM2 напрямую файл server.js (надежнее для Bothost)
# Это заменяет необходимость в отдельном ecosystem.config.js
CMD ["pm2-runtime", "server.js", "--name", "neural-pulse"]
