# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Инструменты для сборки sqlite3 (необходимы для компиляции нативных модулей)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Устанавливаем все зависимости и компилируем sqlite3
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# tini для корректного завершения процессов, libstdc++ для sqlite3
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем зависимости из билдера
COPY --from=builder /app/node_modules ./node_modules
# Копируем остальные файлы проекта
COPY . .

# Создаем папки. Смена владельца (chown) идет ПОСЛЕ установки всех файлов
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app

# Устанавливаем PM2 до переключения на пользователя node
RUN npm install -g pm2

# Настройки окружения
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Точка входа через tini (защита от зомби-процессов)
ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на пользователя node
USER node

# Запускаем через PM2
# --env production берет настройки из секции env_production твоего ecosystem.config.js
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
