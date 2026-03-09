# --- ЭТАП 1: Сборка (Build-stage) ---
FROM node:18-alpine AS builder

# Устанавливаем инструменты сборки
# ВАЖНО: Добавлен симлинк ln -sf python3 /usr/bin/python, чтобы node-gyp нашел Python
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app

# Копируем файлы манифеста отдельно для кэширования слоев
COPY package*.json ./

# Устанавливаем зависимости. Флаг --build-from-source для sqlite3 критичен на Alpine
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source && \
    npm cache clean --force

# --- ЭТАП 2: Финальный образ (Runtime-stage) ---
FROM node:18-alpine

# libstdc++ нужен для работы бинарника sqlite, tini для сигналов
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем только то, что нужно для работы
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Настройка прав доступа
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app/data /app/logs && \
    chmod -R 755 /app/data /app/logs

# Глобальная установка PM2 (в финальном слое)
RUN npm install -g pm2 && npm cache clean --force

ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=1024 --no-warnings"

EXPOSE 3000

# Проверка работоспособности (Healthcheck)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {if(r.statusCode >= 400)process.exit(1)})" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]

USER node

# Запуск. Убедись, что файл ecosystem.config.js есть в корне!
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
