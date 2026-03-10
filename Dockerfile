# --- ЭТАП 1: Установка зависимостей ---
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем только файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости. 
# Теперь здесь НЕТ sqlite3, поэтому компиляция не начнется.
RUN npm ci --only=production

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Устанавливаем tini для корректной обработки сигналов остановки (SIGTERM/SIGINT)
RUN apk add --no-cache tini

WORKDIR /app

# Устанавливаем PM2 глобально
RUN npm install -g pm2 && npm cache clean --force

# Копируем node_modules из билдера
COPY --from=builder /app/node_modules ./node_modules
# Копируем исходный код
COPY . .

# Настройка прав доступа (Критично для записи файла users.json)
# Создаем папки и даем права пользователю node
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app && \
    chmod -R 775 /app/data /app/logs

# Настройки среды
ENV NODE_ENV=production
ENV PORT=3000

# Открываем порт
EXPOSE 3000

# Tini поможет PM2 корректно сохранить JSON при перезагрузке контейнера
ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на безопасного пользователя
USER node

# Запуск через PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
