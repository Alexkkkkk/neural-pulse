# --- ЭТАП 1: Сборка зависимостей ---
FROM node:18-alpine AS builder

# Установка инструментов для компиляции sqlite3 и нативных модулей
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev

WORKDIR /app

COPY package*.json ./

# Устанавливаем зависимости и принудительно компилируем sqlite3 под архитектуру
RUN npm install --include=dev && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Финальный образ ---
FROM node:18-alpine

# Нам нужен только runtime для sqlite
RUN apk add --no-cache libstdc++

WORKDIR /app

# Копируем только то, что нужно для работы (без исходников компиляции)
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Настройка прав для данных
RUN mkdir -p /app/data && chmod 777 /app/data

# Окружение для Node.js в режиме Production (выключает лишние логи и дебаг)
ENV NODE_ENV=production
# Лимит памяти для Node.js (чтобы контейнер не падал при скачках трафика)
ENV NODE_OPTIONS="--max-old-space-size=2048"

EXPOSE 3000

# Используем PM2 для управления процессами (авто-рестарт и кластеризация)
RUN npm install -g pm2

# Запуск в режиме кластера (по количеству ядер процессора)
CMD ["pm2-runtime", "server.js", "-i", "max"]
