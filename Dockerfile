# Используем стабильную версию ноды
FROM node:18-alpine

# Устанавливаем git
RUN apk add --no-cache git

# Создаем рабочую директорию
WORKDIR /app

# Копируем конфиги пакетов
COPY package*.json ./

# Чистая установка зависимостей
RUN npm install --omit=dev

# Копируем весь проект
COPY . .

# Создаем папку для БД и даем права (оставляем root для совместимости с Bothost)
RUN mkdir -p /app/data && chmod 777 /app/data

# Открываем порт 3000 (стандарт для Bothost)
EXPOSE 3000

# Финальный запуск:
# Мы запускаем только твой сервер. 
# Если Bothost все равно подменит CMD, этот файл хотя бы соберется без ошибок прав.
CMD ["node", "server.js"]
