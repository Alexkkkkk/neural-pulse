# --- ЭТАП 1: Сборка (Builder) ---
FROM node:18-alpine AS builder

# Устанавливаем ВСЕ необходимые инструменты для сборки нативных модулей
# python3, make, g++ нужны для node-gyp (компиляция sqlite3)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    sqlite-dev \
    linux-headers

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости. 
# Мы используем --build-from-source, чтобы sqlite3 точно скомпилировался под архитектуру Alpine
RUN npm ci && npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Запуск (Runtime) ---
FROM node:18-alpine

# Устанавливаем tini для обработки сигналов и библиотеки рантайма sqlite
# libstdc++ и sqlite-libs обязательны для работы скомпилированного модуля
RUN apk add --no-cache tini libstdc++ sqlite-libs

WORKDIR /app

# Устанавливаем PM2 глобально
RUN npm install -g pm2 && npm cache clean --force

# Копируем собранные node_modules и бинарники из билдера
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Настройка прав доступа (КРИТИЧЕСКИ ВАЖНО для Bothost)
# SQLite создает временные файлы (WAL/Journal), поэтому node должен владеть папкой данных
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app && \
    chmod -R 775 /app/data /app/logs

# Переменные окружения по умолчанию
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Используем tini для правильной обработки SIGTERM (важно для сохранения БД при перезагрузке)
ENTRYPOINT ["/sbin/tini", "--"]

# Работаем от имени непривилегированного пользователя
USER node

# Если у тебя НЕТ файла ecosystem.config.js, замени на: CMD ["pm2-runtime", "server.js"]
CMD ["pm2-runtime", "ecosystem.config.js"]
