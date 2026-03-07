# 1. Используем Python
FROM python:3.11-slim

# 2. Рабочая директория
WORKDIR /app

# 3. Системные зависимости для SQLite
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc python3-dev libsqlite3-dev && rm -rf /var/lib/apt/lists/*

# 4. Копируем зависимости (путь к твоему файлу в GitHub)
COPY services/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Копируем ВЕСЬ проект
COPY . .

# 6. Создаем папку для базы (важно для Bothost)
RUN mkdir -p /app/data && chmod 777 /app/data

# 7. Порт Bothost
EXPOSE 3000

# 8. ТОЧНАЯ КОМАНДА ЗАПУСКА (без Node.js!)
CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "3000"]
