# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Устанавливаем зависимости для сборки нативных модулей (sqlite3)
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev

WORKDIR /app

# Копируем конфиги зависимостей
COPY package*.json ./

# Устанавливаем зависимости и принудительно пересобираем sqlite3 из исходников под текущую архитектуру
RUN npm ci && npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Устанавливаем tini для обработки сигналов и системные библиотеки для работы sqlite
RUN apk add --no-cache tini libstdc++ sqlite-libs

WORKDIR /app

# Устанавливаем PM2 глобально для управления процессом
RUN npm install -g pm2 && npm cache clean --force

# Копируем только собранные node_modules из билдера
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходный код проекта
COPY . .

# Исправление прав доступа:
# 1. Создаем папки заранее
# 2. Убеждаемся, что пользователь node имеет права на запись во всем каталоге /app
# Это критично для SQLite, так как она создает временные -journal и -wal файлы в той же папке
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app && \
    chmod -R 755 /app/data

# Настройки среды
ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_APP_URL=https://np.bothost.ru

# Открываем порт для прокси хостинга
EXPOSE 3000

# Используем tini как init-процесс для корректного проброса сигналов SIGTERM/SIGINT
ENTRYPOINT ["/sbin/tini", "--"]

# Переключаемся на безопасного пользователя
USER node

# Запуск. Убедись, что файл ecosystem.config.js существует в корне проекта
CMD ["pm2-runtime", "ecosystem.config.js"]
