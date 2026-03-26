# Используем стабильную версию Node.js (20-slim — легкая и быстрая)
FROM node:20-slim

# Устанавливаем системные зависимости для сборки (нужны для AdminJS и Sequelize)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Создаем рабочую директорию внутри контейнера
WORKDIR /app

# Устанавливаем переменную окружения для оптимизации библиотек
ENV NODE_ENV=production

# Сначала копируем только файлы зависимостей (для быстрого кэширования слоев)
COPY package*.json ./

# Устанавливаем зависимости + Recharts для графиков в админке
RUN npm install --production && npm install recharts && npm cache clean --force

# Копируем весь остальной код проекта
COPY . .

# Очистка и подготовка кэша AdminJS (решает проблему с "розовой ошибкой")
RUN rm -rf .adminjs && mkdir -p .adminjs && chmod -R 777 .adminjs

# Удаляем дубликат компонента из корня, если он там остался
RUN rm -f dashboard-component.jsx 

# Открываем порты: 3000 (основной бот/API) и 3001 (панель администратора)
EXPOSE 3000
EXPOSE 3001

# ГЛАВНАЯ КОМАНДА: Запуск через твой основной файл server.js
CMD ["node", "server.js"]
