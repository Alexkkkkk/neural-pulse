# Стейдж сборки: используем Python 3.11
FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Отключаем кэш питона и логируем сразу в консоль
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Ставим зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем проект
COPY . .

# Открываем порт 3000
EXPOSE 3000

# ЯВНО указываем путь к python3
ENTRYPOINT ["/usr/local/bin/python3", "main.py"]
