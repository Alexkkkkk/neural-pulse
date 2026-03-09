# --- ЭТАП 1: Сборка ---
FROM node:18-alpine AS builder

# Устанавливаем инструменты сборки и Python3
# Создаем симлинк, чтобы система видела 'python'
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Устанавливаем зависимости и заставляем sqlite3 компилироваться
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Рантайм ---
FROM node:18-alpine

# Для работы скомпилированного sqlite3 нужна библиотека libstdc++
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только готовые node_modules из первого этапа
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем папки для БД и логов
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs

# Глобально ставим PM2
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запуск через PM2
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
