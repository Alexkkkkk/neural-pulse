FROM python:3.11-slim

WORKDIR /app

# Принудительная установка всех библиотек без использования кэша
RUN pip install --no-cache-dir \
    aiogram==3.4.1 \
    aiohttp==3.9.3 \
    python-dotenv==1.0.1 \
    requests==2.32.5

# Копируем файлы проекта
COPY . .

# Настройка прав для базы данных
RUN mkdir -p /app/data && chmod 777 /app/data

# Открываем порт 3000
EXPOSE 3000

# Запуск
CMD ["python", "bot/main.py"]
