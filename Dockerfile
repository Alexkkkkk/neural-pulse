# 1. Используем легкий образ Python
FROM python:3.11-slim

# 2. Устанавливаем рабочую директорию
WORKDIR /bot

# 3. Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. Копируем и устанавливаем зависимости Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Копируем ВЕСЬ код из папки bot в рабочую директорию контейнера
# Теперь main.py и http_wrapper.py лежат прямо в /app/
COPY . .

# 6. Создаем папку для данных (если бот пишет логи или БД в файлы)
RUN mkdir -p /app/data && chmod 777 /app/data

# 7. Запускаем обертку http_wrapper.py
# Она сама запустит main.py в фоновом потоке
CMD ["python", "main.py"]
