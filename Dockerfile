FROM node:18-alpine

# Установка системных утилит
RUN apk add --no-cache git

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm install --omit=dev

# Копирование кода
COPY . .

# Настройка прав и папок
RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Главная команда
CMD ["node", "server.js"]
