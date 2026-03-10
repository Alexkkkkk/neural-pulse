# --- ЭТАП 1: Сборка ---
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем конфиги зависимостей
COPY package*.json ./

# Устанавливаем только продакшн-зависимости (без тяжелых dev-пакетов)
RUN npm ci --omit=dev

# --- ЭТАП 2: Рантайм (Финальный образ) ---
FROM node:18-alpine

# Устанавливаем tini для обработки сигналов и PM2 для управления процессом
RUN apk add --no-cache tini && \
    npm install -g pm2 && \
    npm cache clean --force

WORKDIR /app

# Копируем установленные модули из этапа сборки
COPY --from=builder /app/node_modules ./node_modules

# Копируем весь исходный код проекта
COPY . .

# Настройка прав (ВЫПОЛНЯЕТСЯ ПОСЛЕ COPY)
# Создаем папки для БД и логов и передаем права пользователю node
USER root
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app && \
    chmod -R 775 /app/data /app/logs

# Пробрасываем переменную порта (Bothost использует 3000)
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Используем tini как прослойку для корректного Graceful Shutdown
ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на безопасного пользователя
USER node

# Запуск через PM2 с использованием твоего конфига
CMD ["pm2-runtime", "ecosystem.config.js"]
