# --- ЭТАП 1: Установка зависимостей (Сборщик) ---
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем только файлы зависимостей для кэширования этого слоя
COPY package*.json ./

# Устанавливаем только production-пакеты (без devDependencies)
# Теперь без sqlite3 это не требует компиляторов и Python
RUN npm ci --only=production

# --- ЭТАП 2: Запуск (Финальный образ) ---
FROM node:18-alpine

# Устанавливаем tini для корректного завершения процессов
# и pm2 для управления приложением
RUN apk add --no-cache tini && \
    npm install -g pm2 && \
    npm cache clean --force

WORKDIR /app

# Копируем зависимости из этапа сборки
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходный код проекта
COPY . .

# Создаем директории для данных и логов, настраиваем права доступа
# Это критично для того, чтобы JSON база могла сохраняться
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app && \
    chmod -R 775 /app/data /app/logs

# Настройки среды (дублируем на всякий случай)
ENV NODE_ENV=production
ENV PORT=3000

# Информируем Docker об используемом порте
EXPOSE 3000

# Используем tini как точку входа для обработки системных сигналов (SIGTERM/SIGINT)
ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на непривилегированного пользователя для безопасности
USER node

# Запуск приложения через PM2
# pm2-runtime специально создан для работы внутри Docker-контейнеров
CMD ["pm2-runtime", "ecosystem.config.js"]
