# --- ЭТАП 1: Сборка (Build) ---
FROM node:18-alpine AS builder

# Устанавливаем инструменты для компиляции sqlite3
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Чистая установка зависимостей
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Библиотеки для работы скомпилированного sqlite3 и tini для стабильности
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем результат сборки
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем структуру папок (КРИТИЧНО для PM2 и SQLite)
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs

# Установка PM2 для управления процессом
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Использование tini защищает от зависших процессов (зомби)
ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запускаем через PM2 конфиг
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
