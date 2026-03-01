# Указываем базовый образ Python максимально явно
FROM python:3.11-slim

# Установка зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends gcc python3-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем требования
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь проект
COPY . .

# Открываем порт
EXPOSE 3000

# ИСПОЛЬЗУЕМ ENTRYPOINT ВМЕСТО CMD (его сложнее переопределить системе)
ENTRYPOINT ["python3", "main.py"]
