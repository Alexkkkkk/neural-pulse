FROM node:18-alpine
RUN apk add --no-cache git && npm install pm2 -g
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app
EXPOSE 3000
# Используем обычный CMD, но через PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
