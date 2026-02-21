# 1. Используем легкий образ
FROM python:3.11-slim

# 2. Рабочая папка (внутри контейнера)
WORKDIR /bot

# 3. Установка системных утилит
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Копируем ВСЕ файлы твоего проекта
# Теперь main.py и http_wrapper.py лежат прямо в /bot/
COPY . .

# 6. Права доступа
RUN mkdir -p /bot/data && chmod 777 /bot/data

# 7. САМОЕ ВАЖНОЕ: Запуск
# Мы запускаем http_wrapper.py, потому что он откроет порт 3000 для Bothost
CMD ["python", "http_wrapper.py"]
