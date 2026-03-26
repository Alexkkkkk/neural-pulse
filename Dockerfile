# Используем Node.js 20-slim
FROM node:20-slim

# Устанавливаем зависимости для сборки
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Переменные окружения
ENV NODE_ENV=production
# Увеличиваем лимит памяти для сборки фронтенда AdminJS
ENV NODE_OPTIONS="--max-old-space-size=1024"

COPY package*.json ./

# Установка всех зависимостей (включая dev для сборки, если нужно)
RUN npm install --production && npm cache clean --force

COPY . .

# Подготовка папок для кэша AdminJS
RUN mkdir -p .adminjs && chmod -R 777 .adminjs
RUN mkdir -p static/.adminjs && chmod -R 777 static/.adminjs

# Проверка наличия директории с картинками
RUN mkdir -p static/images

EXPOSE 3000
EXPOSE 3001

CMD ["node", "server.js"]
