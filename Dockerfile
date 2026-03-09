# --- ЭТАП 1: Сборка ---
FROM node:18-alpine AS builder

# Устанавливаем ВСЕ необходимые инструменты для компиляции C++ модулей
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app

COPY package*.json ./

# Устанавливаем только продакшн зависимости
# Мы НЕ используем здесь npm run rebuild отдельно, так как sqlite3 соберется сам
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Рантайм ---
FROM node:18-alpine

# Для работы бинарника sqlite3 в Alpine нужен libstdc++
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем скомпилированные модули и код
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Создаем папки для БД и логов
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs

# PM2 лучше ставить глобально в финальном слое
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Обязательно используем tini для правильной обработки стоп-сигналов (SIGTERM)
ENTRYPOINT ["/sbin/tini", "--"]

USER node

# Запуск через скрипт prod из package.json
CMD ["npm", "run", "prod"]
