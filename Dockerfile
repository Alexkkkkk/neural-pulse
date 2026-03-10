# Этап сборки
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# Этап рантайма
FROM node:18-alpine
RUN apk add --no-cache tini
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Настройка папок и прав
RUN mkdir -p /app/data /app/logs && \
    if [ ! -f /app/data/users.json ]; then echo "{}" > /app/data/users.json; fi && \
    chown -R node:node /app && \
    chmod -R 775 /app/data /app/logs

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запускаем наш переименованный файл
CMD ["node", "http-wrapper.js"]
