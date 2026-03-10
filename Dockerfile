FROM node:18-alpine

# Ставим PM2
RUN npm install pm2 -g

WORKDIR /app

# Ставим зависимости
COPY package*.json ./
RUN npm install --omit=dev

# Копируем всё
COPY . .

# Настройка прав
RUN mkdir -p /app/data /app/logs && \
    if [ ! -f /app/data/users.json ]; then echo "{}" > /app/data/users.json; fi && \
    chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 3000

# Запускаем через PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
