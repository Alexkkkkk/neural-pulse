# 1. Легкий образ Python
FROM python:3.11-slim

# 2. Устанавливаем рабочую директорию
WORKDIR /bot

# 3. Установка зависимостей системы
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential && rm -rf /var/lib/apt/lists/*

# 4. Установка библиотек
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Копируем все файлы бота в /bot
COPY . .

# 6. Создаем папку для базы данных
RUN mkdir -p /bot/data && chmod 777 /bot/data

# 7. ЗАПУСК через обертку (чтобы хостинг не выключал бота)
CMD ["python", "http_wrapper.py"]
