# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Устанавливаем системные зависимости для сборки нативных модулей (sqlite3)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python

WORKDIR /app

# Копируем файлы зависимостей отдельно, чтобы использовать кэш слоев Docker
COPY package*.json ./

# Устанавливаем все зависимости и собираем sqlite3 из исходников под текущую архитектуру
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Устанавливаем библиотеки времени выполнения
RUN apk add --no-cache tini libstdc++

WORKDIR /app

# Копируем скомпилированные модули из сборщика
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходный код приложения
COPY . .

# Устанавливаем PM2 глобально
RUN npm install -g pm2 && npm cache clean --force

# Создаем директории для данных и логов, затем передаем права пользователю node
# Это критично, чтобы SQLite мог записывать файл базы данных
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app

# Настройки среды
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Используем tini для правильной обработки сигналов (SIGTERM, SIGINT)
ENTRYPOINT ["/sbin/tini", "--"]

# Запускаем от имени непривилегированного пользователя
USER node

# Запуск через PM2 с использованием твоего конфига
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
