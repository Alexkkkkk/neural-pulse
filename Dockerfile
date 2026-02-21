# 1. Используем легкий образ Python
FROM python:3.11-slim

# 2. Устанавливаем рабочую директорию /bot
WORKDIR /bot

# 3. Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Копируем всё содержимое твоей папки в /bot
# Теперь файлы main.py, http_wrapper.py и .env лежат прямо в /bot/
COPY . .

# 6. Создаем папку для данных прямо внутри /bot
RUN mkdir -p /bot/data && chmod 777 /bot/data

# 7. Запуск через обертку
# Важно: запускаем http_wrapper.py, так как мы уже находимся в /bot
CMD ["python", "http_wrapper.py"]
