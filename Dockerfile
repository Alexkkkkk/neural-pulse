FROM node:18-alpine

# Устанавливаем PM2 глобально
RUN npm install pm2 -g

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Удаляем системную заглушку, если она есть, и создаем папки
RUN rm -f /app/http-wrapper.js && \
    mkdir -p /app/data /app/logs && \
    chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 3000

# Запускаем через PM2 в режиме non-daemon (чтобы контейнер не закрылся)
CMD ["pm2-runtime", "ecosystem.config.js"]
