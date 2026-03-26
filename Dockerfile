# Используем стабильную версию Node.js (slim для экономии ресурсов)
FROM node:20-slim

# Устанавливаем системные зависимости для сборки библиотек и AdminJS
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Создаем рабочую директорию
WORKDIR /app

# Оптимизация для продакшн-сборки
ENV NODE_ENV=production

# Кэшируем установку зависимостей
COPY package*.json ./
RUN npm install && npm cache clean --force

# Копируем весь исходный код (включая dashboard-component.jsx и папку static)
COPY . .

# Создаем папку для кэша AdminJS с полными правами (решает проблему с розовой ошибкой)
RUN mkdir -p .adminjs && chmod -R 777 .adminjs

# Открываем порты: 3000 (Бот), 3001 (Админка)
EXPOSE 3000
EXPOSE 3001

# Запуск через главный диспетчер
CMD ["node", "server.js"]
