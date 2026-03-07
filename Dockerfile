FROM python:3.11-slim

WORKDIR /app

# Устанавливаем зависимости
COPY services/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всё дерево проекта
COPY . .

# Создаем папку data, если её нет
RUN mkdir -p /app/data && chmod 777 /app/data

# Открываем порт
EXPOSE 3000

# ВАЖНО: Запускаем API сервис на Python
# Убедись, что путь к main.py верный (относительно корня)
CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "3000"]
