# Базовый образ Питона
FROM python:3.11-slim

# Установка зависимостей
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всё
COPY . .

# Открываем порт
EXPOSE 3000

# ИСПОЛЬЗУЕМ JSON-ФОРМАТ (это критично, чтобы хостинг не подставил 'node' перед командой)
ENTRYPOINT ["python3", "main.py"]
