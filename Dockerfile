# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Инструменты для сборки sqlite3 (необходимы для компиляции нативных модулей)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для сборки) и компилируем sqlite3
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# tini для корректного завершения процессов, libstdc++ для sqlite3
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем зависимости и файлы проекта
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем папки и выставляем права ОДНОЙ командой (быстрее и надежнее)
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app

# Ставим PM2 глобально
RUN npm install -g pm2

# Настройки окружения
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Точка входа через tini
ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на безопасного пользователя
USER node

# Запускаем через PM2, используя твой файл конфигурации
# Флаг --env production активирует настройки из env_production в ecosystem.config.js
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
