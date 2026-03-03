# Используем образ Python
FROM python:3.10-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем системные зависимости для SQLite
RUN apt-get update && apt-get install -y gcc python3-dev && rm -rf /var/lib/apt/lists/*

# Сначала копируем зависимости и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# КОПИРУЕМ ВСЕ ФАЙЛЫ ИЗ ТВОЕГО GITHUB (включая index.html)
COPY . .

# Проверяем наличие файлов (результат будет в логах сборки)
RUN ls -la /app

# Открываем порт 3000
EXPOSE 3000

# Запускаем бота
CMD ["python", "main.py"]
