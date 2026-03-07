# Используем легкий образ Python
FROM python:3.10-slim

# Устанавливаем системные зависимости для сборки некоторых библиотек
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Создаем рабочую директорию
WORKDIR /app

# Копируем список зависимостей
COPY requirements.txt .

# Устанавливаем зависимости Python
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь проект
COPY . .

# Создаем папку для базы данных и даем права (важно для Bothost)
RUN mkdir -p /app/data && chmod 777 /app/data

# Открываем порт 3000
EXPOSE 3000

# Запускаем сервер (убедись, что главный файл называется server.py)
CMD ["python", "server.py"]
