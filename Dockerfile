# --- СТАДИЯ 1: Сборка ---
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Используем корректный синтаксис для пропуска dev-зависимостей
RUN npm ci --omit=dev

# --- СТАДИЯ 2: Рантайм ---
FROM node:18-alpine
RUN apk add --no-cache tini
# Устанавливаем PM2 глобально
RUN npm install -g pm2 && npm cache clean --force

WORKDIR /app
# Копируем зависимости из билдера
COPY --from=builder /app/node_modules ./node_modules
# Копируем проект
COPY . .

# Настройка прав для JSON базы
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app && \
    chmod -R 775 /app/data /app/logs

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
USER node

# Запускаем через твой конфиг PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
