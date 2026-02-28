# Использование современного образа Python
FROM python:3.10-slim

# Настройка рабочей папки
WORKDIR /app

# Установка необходимых системных библиотек (если нужны)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Копируем список зависимостей
COPY requirements.txt .

# Устанавливаем библиотеки
RUN pip install --no-cache-dir -r requirements.txt

# Копируем все остальные файлы проекта
COPY . .

# Открываем порт для сервера
EXPOSE 3000

# Запускаем скрипт
CMD ["python", "http_wrapper.py"]
