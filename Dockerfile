FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные зависимости для SQLite
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc python3-dev libsqlite3-dev && rm -rf /var/lib/apt/lists/*

# Копируем зависимости и устанавливаем их
# Путь должен соответствовать твоей структуре в GitHub
COPY services/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всё дерево проекта
COPY . .

# Создаем папку для базы данных и даем права
RUN mkdir -p /app/data && chmod 777 /app/data

# Открываем порт 3000 (стандарт для Bothost)
EXPOSE 3000

# ЯВНЫЙ ЗАПУСК: указываем путь к приложению FastAPI через точку
CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "3000", "--proxy-headers"]
