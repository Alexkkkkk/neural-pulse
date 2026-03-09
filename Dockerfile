# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Устанавливаем ВСЕ необходимые инструменты для компиляции sqlite3
# alpine использует python3, поэтому делаем симлинк на python
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./

# Устанавливаем зависимости и заставляем sqlite3 компилироваться из исходников
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Для работы скомпилированного sqlite3 нужна библиотека libstdc++
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только то, что реально нужно для работы (без мусора сборки)
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем папки для БД и логов
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs

# Ставим PM2 глобально
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запуск через твой скрипт prod
CMD ["npm", "run", "prod"]
