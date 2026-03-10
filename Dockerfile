FROM node:18-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && echo "✅ Зависимости установлены"
COPY . .
RUN mkdir -p /app/data && echo "✅ Папка данных готова"
EXPOSE 3000
CMD ["node", "server.js"]
