# Используем стабильную версию Node.js
FROM node:20-slim

# Устанавливаем системные зависимости для работы с PostgreSQL и компиляции
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Создаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости (включая dev для сборки AdminJS)
RUN npm install

# Копируем все остальные файлы проекта
COPY . .

# Открываем порт, который использует приложение
EXPOSE 3000

# Команда запуска
CMD ["node", "main.py"]
