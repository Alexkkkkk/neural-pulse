FROM node:18-alpine

# Установка зависимостей для сборки SQLite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Создание папки для БД
RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 3000

CMD ["npm", "start"]
