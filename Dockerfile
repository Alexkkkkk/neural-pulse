# --- ЭТАП 1: Сборка ---
FROM node:18-alpine AS builder
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite-dev && \
    ln -sf python3 /usr/bin/python
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && \
    npm rebuild sqlite3 --build-from-source

# --- ЭТАП 2: Рантайм ---
FROM node:18-alpine
RUN apk add --no-cache tini libstdc++
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Папки для базы и логов
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs
RUN npm install -g pm2

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запускаем через PM2, он обеспечит стабильность 24/7
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
