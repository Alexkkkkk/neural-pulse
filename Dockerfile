# --- ЭТАП 1: Сборка (Build) ---
FROM node:18-alpine AS builder

# Устанавливаем инструменты для компиляции sqlite3
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Установка зависимостей и сборка нативных модулей
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Устанавливаем библиотеки времени выполнения и tini для корректной остановки
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только собранные модули и код проекта
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем структуру папок и выставляем права (обязательно для SQLite)
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs

# Устанавливаем PM2 глобально
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Использование tini предотвращает появление зомби-процессов
ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запуск через PM2 с использованием твоего конфига
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
