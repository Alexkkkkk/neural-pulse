# --- ЭТАП 1: Сборка (Build-stage) ---
FROM node:18-alpine AS builder

# Устанавливаем инструменты сборки и Python
# Создаем симлинк, чтобы node-gyp видел python3 как python
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Устанавливаем зависимости и заставляем sqlite3 собраться из исходников
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Финальный образ (Runtime-stage) ---
FROM node:18-alpine

# Добавляем только минимально необходимые библиотеки для запуска
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только готовые модули и файлы проекта
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем папки для БД и логов с правильными правами
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs

# Устанавливаем PM2 для управления процессом
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запуск через твой ecosystem файл
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
