FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные зависимости для базы данных
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc python3-dev libsqlite3-dev && rm -rf /var/lib/apt/lists/*

# Копируем и устанавливаем зависимости Python
COPY services/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем все файлы проекта
COPY . .

# Создаем папку для базы данных и задаем права доступа
RUN mkdir -p /app/data && chmod 777 /app/data

# Открываем порт 3000 для Bothost
EXPOSE 3000

# ЯВНЫЙ ЗАПУСК: запускаем FastAPI, который сам раздаст статику
CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "3000", "--proxy-headers"]
