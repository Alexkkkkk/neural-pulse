# --- ЭТАП 1: Сборка (Build) ---
FROM node:18-alpine AS builder

# Устанавливаем инструменты для компиляции sqlite3
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Установка зависимостей без dev-пакетов
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Устанавливаем библиотеки для sqlite3 и tini для управления процессами
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем собранные модули из первого этапа
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем структуру папок для БД и логов (обязательно для SQLite и PM2)
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs

# Установка PM2 глобально
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Использование tini предотвращает "зависание" контейнера
ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запуск через профессиональный менеджер процессов
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
