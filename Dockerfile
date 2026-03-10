# --- ЭТАП 1: Сборка ---
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем конфиги зависимостей
COPY package*.json ./

# Устанавливаем зависимости (clean install)
RUN npm ci --omit=dev

# --- ЭТАП 2: Рантайм ---
FROM node:18-alpine

# Устанавливаем системные утилиты и PM2
RUN apk add --no-cache tini && \
    npm install -g pm2 && \
    npm cache clean --force

WORKDIR /app

# Переносим модули из билдера
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходный код
COPY . .

# Настройка прав доступа (ВЫПОЛНЯЕТСЯ ПОСЛЕ COPY)
USER root
RUN mkdir -p /app/data /app/logs && \
    # Создаем пустой файл БД, если он отсутствует, чтобы избежать ошибок прав
    touch /app/data/users.json && \
    chown -R node:node /app && \
    chmod -R 775 /app/data /app/logs

# Переменные окружения
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Использование tini предотвращает проблему "PID 1" в контейнере
ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на непривилегированного пользователя
USER node

# Запуск через PM2 Runtime (специальная версия для Docker)
CMD ["pm2-runtime", "ecosystem.config.js"]
