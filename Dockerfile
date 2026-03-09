# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Системные зависимости для компиляции sqlite3
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev

WORKDIR /app

# Копируем только файлы зависимостей для кэширования слоев
COPY package*.json ./

# Чистая установка и сборка sqlite3 из исходников
RUN npm ci && npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Устанавливаем tini (для обработки сигналов) и библиотеки для sqlite
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Устанавливаем PM2 глобально
RUN npm install -g pm2 && npm cache clean --force

# Сначала копируем зависимости из билдера
COPY --from=builder /app/node_modules ./node_modules

# Копируем всё остальное
COPY . .

# Создаем нужные папки и ОДНИМ МАХОМ отдаем права пользователю node на всё
# Это гарантирует, что база данных в /app/data создастся и будет работать
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app

# Настройки среды
ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_APP_URL=https://np.bothost.ru

# Открываем порт
EXPOSE 3000

# Правильная обработка сигналов завершения (SIGTERM)
ENTRYPOINT ["/sbin/tini", "--"]

# Работаем от имени непривилегированного пользователя
USER node

# Запуск через PM2-runtime (он лучше держит процесс в контейнере)
CMD ["pm2-runtime", "ecosystem.config.js"]
