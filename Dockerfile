# --- ЭТАП 1: Сборка ---
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Используем install, если в репозитории нет package-lock.json
RUN npm install --omit=dev

# --- ЭТАП 2: Рантайм ---
FROM node:18-alpine
RUN apk add --no-cache tini
WORKDIR /app

# Копируем зависимости и код
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# --- [ИСПРАВЛЕНИЕ] ---
# Удаляем конфликтный файл, если он был создан процессом сборки хостинга
RUN rm -f /app/http-wrapper.js

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

# Запускаем ТОЛЬКО твой сервер (игнорируем любые сторонние CMD)
CMD ["node", "server.js"]
