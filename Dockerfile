FROM node:18-alpine

# Устанавливаем PM2 для стабильности
RUN npm install pm2 -g

WORKDIR /app

# Копируем зависимости
COPY package*.json ./
RUN npm install --omit=dev

# Копируем проект
COPY . .

# Создаем папки и фиксируем права
RUN mkdir -p /app/data /app/logs && \
    if [ ! -f /app/data/users.json ]; then echo "{}" > /app/data/users.json; fi && \
    chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# ENTRYPOINT игнорирует попытки хостинга запустить что-то другое
ENTRYPOINT ["pm2-runtime", "ecosystem.config.js"]
