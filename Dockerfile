# Указываем базовый образ Python максимально явно
FROM python:3.11-slim

# Установка системных зависимостей для сборки
RUN apt-get update && apt-get install -y --no-install-recommends gcc python3-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем и ставим зависимости Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всё остальное
COPY . .

# Открываем порт 3000 (тот, что в коде)
EXPOSE 3000

# ИСПОЛЬЗУЕМ ENTRYPOINT — это самая жесткая команда запуска, 
# которую хостингу сложнее всего подменить своим 'node'
ENTRYPOINT ["python3", "main.py"]
