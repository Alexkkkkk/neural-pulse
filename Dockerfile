FROM node:18-alpine

# Устанавливаем системные зависимости для компиляции sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Копируем конфиги и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем файлы проекта
COPY . .

# Создаем папку для базы данных, чтобы она не пропала
RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 3000

# ЗАПУСК: Только твой сервер и ничего лишнего
CMD ["node", "server.js"]
