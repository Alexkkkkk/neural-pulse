FROM node:18-alpine

# Устанавливаем инструменты сборки (нужны для компиляции sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
# Устанавливаем зависимости
RUN npm install

COPY . .

# Создаем папку для БД
RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 3000

CMD ["node", "server.js"]
