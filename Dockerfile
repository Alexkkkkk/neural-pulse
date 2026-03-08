FROM node:18-alpine

# Устанавливаем зависимости для сборки (нужно для sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Сначала копируем только конфиги для кэширования слоев
COPY package*.json ./
RUN npm install

# Копируем всё остальное
COPY . .

# Создаем папку для базы данных и даем права
RUN mkdir -p /app/data && chmod 777 /app/data

# Открываем порт
EXPOSE 3000

# ЗАПУСК: только твой сервер
CMD ["node", "server.js"]
