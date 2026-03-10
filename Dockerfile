FROM node:18-alpine
RUN apk add --no-cache git && npm install pm2 -g
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/data /app/logs && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 3000

# Удаляем файл-заглушку хостинга прямо перед стартом
ENTRYPOINT rm -f http-wrapper.js && pm2-runtime ecosystem.config.js
