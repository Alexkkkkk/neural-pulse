# --- СТАДИЯ 1: СБОРКА ---
FROM node:18-alpine AS builder

# Устанавливаем инструменты сборки и Python (решает твою ошибку gyp ERR!)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Устанавливаем зависимости и заставляем sqlite3 скомпилироваться под Alpine
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- СТАДИЯ 2: ЗАПУСК ---
FROM node:18-alpine

# Для работы скомпилированного sqlite3 нужна библиотека libstdc++
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только готовые модули и код
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Настройка прав для базы данных
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs

# Ставим PM2 глобально в финальный образ
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запуск через PM2
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
