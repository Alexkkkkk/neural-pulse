FROM node:18-alpine

# 1. Устанавливаем системные зависимости, необходимые для сборки бинарных модулей (sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 2. Копируем файлы манифеста
COPY package*.json ./

# 3. Устанавливаем зависимости. 
# Флаг --build-from-source заставляет sqlite3 скомпилироваться именно под текущую ОС (Alpine)
RUN npm install --build-from-source sqlite3 && npm install

# 4. Копируем остальные файлы проекта
COPY . .

# 5. Создаем папку для базы данных и выставляем права
# Важно: если Bothost использует volumes, папка /app/data должна быть в исключениях или примонтирована
RUN mkdir -p /app/data && chmod 777 /app/data

# 6. Удаляем кэш и инструменты сборки, чтобы уменьшить размер образа (необязательно, но полезно)
# RUN apk del python3 make g++

EXPOSE 3000

# ЗАПУСК
CMD ["node", "server.js"]
