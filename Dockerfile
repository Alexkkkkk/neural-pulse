# --- ЭТАП 1: Сборка ---
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем только файлы зависимостей для кэширования слоев
COPY package*.json ./

# Установка зависимостей (только production)
RUN npm ci --omit=dev

# --- ЭТАП 2: Рантайм (Финальный образ) ---
FROM node:18-alpine

# Устанавливаем tini (обработка сигналов) и pm2 глобально
RUN apk add --no-cache tini && \
    npm install -g pm2 && \
    npm cache clean --force

WORKDIR /app

# Копируем зависимости из билдера
COPY --from=builder /app/node_modules ./node_modules

# Копируем весь проект
COPY . .

# Настройка прав (ВЫПОЛНЯЕТСЯ ПОСЛЕ COPY)
# Нам нужно убедиться, что пользователь node владеет всей папкой /app
USER root
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app && \
    chmod -R 775 /app/data /app/logs

# Настройка переменных окружения
ENV NODE_ENV=production
ENV PORT=3000

# Открываем порт 3000
EXPOSE 3000

# Используем tini для корректного завершения процессов (SIGTERM/SIGINT)
ENTRYPOINT ["/sbin/tini", "--"]

# Работаем от имени пользователя node (безопасность)
USER node

# Запуск через PM2
# pm2-runtime идеально подходит для Docker-контейнеров
CMD ["pm2-runtime", "ecosystem.config.js"]
