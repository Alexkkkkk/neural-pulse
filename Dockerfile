FROM node:18-alpine

# Устанавливаем GIT и PM2
RUN apk add --no-cache git && npm install pm2 -g

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data /app/logs && \
    if [ ! -f /app/data/users.json ]; then echo "{}" > /app/data/users.json; fi && \
    chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# ENTRYPOINT гарантирует запуск PM2
ENTRYPOINT ["pm2-runtime", "ecosystem.config.js"]
