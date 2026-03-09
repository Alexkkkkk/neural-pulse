# --- ЭТАП 1: Сборка (Build-stage) ---
FROM node:18-alpine AS builder

# 1. Устанавливаем зависимости ОС
# 2. Создаем симлинк python3 -> python (это решит твою ошибку в логах)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Устанавливаем зависимости. Флаг --build-from-source гарантирует работу на Alpine
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source && \
    npm cache clean --force

# --- ЭТАП 2: Финальный образ (Runtime-stage) ---
FROM node:18-alpine

# libstdc++ нужен для работы скомпилированного sqlite3
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только готовые модули и код
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Права доступа для папки с базой данных
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs && \
    chmod -R 755 /app/data /app/logs

# Установка PM2 глобально в финальном слое
RUN npm install -g pm2 && npm cache clean --force

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]

USER node

# Запускаем через твой скрипт prod
CMD ["npm", "run", "prod"]
