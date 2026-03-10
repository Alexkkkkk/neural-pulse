FROM node:18-alpine

# Устанавливаем PM2 глобально
RUN npm install pm2 -g

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm install --omit=dev

# Копируем все файлы проекта
COPY . .

# Удаляем возможную заглушку от хостинга, если она попала в слой
RUN rm -f /app/http-wrapper.js && \
    mkdir -p /app/data /app/logs && \
    if [ ! -f /app/data/users.json ]; then echo "{}" > /app/data/users.json; fi && \
    chown -R node:node /app

# Создаем финальный файл из нашего кода (на случай, если COPY не сработал)
COPY http-wrapper.js /app/http-wrapper.js

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# ENTRYPOINT имеет приоритет над CMD хостинга
ENTRYPOINT ["pm2-runtime", "ecosystem.config.js"]
