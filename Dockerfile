FROM node:18-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install --build-from-source sqlite3 && npm install
COPY . .
RUN mkdir -p /app/data && chmod 777 /app/data
EXPOSE 3000
CMD ["node", "server.js"]
