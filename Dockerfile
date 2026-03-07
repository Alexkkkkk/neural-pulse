FROM python:3.11-slim

WORKDIR /app

# Устанавливаем зависимости
COPY services/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всё
COPY . .

# Создаем папку для данных
RUN mkdir -p /app/data && chmod 777 /app/data

# Открываем порт для Bothost
EXPOSE 3000

# ГАРАНТИЯ ЗАПУСКА PYTHON:
CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "3000"]
