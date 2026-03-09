# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Устанавливаем инструменты для компиляции sqlite3 (решает проблему gyp ERR!)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Установка зависимостей и сборка нативных модулей
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Необходимые библиотеки для рантайма и tini для управления процессами
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только то, что нужно для работы
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем структуру папок для БД и логов (обязательно для SQLite и PM2)
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs

# Ставим PM2 глобально
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# tini предотвращает зависание контейнера при остановке
ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запуск через профессиональный менеджер процессов PM2
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
