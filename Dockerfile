FROM node:18-alpine

# Устанавливаем зависимости для сборки sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Создаем папку data и даем права
RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 3000

CMD ["npm", "start"]
