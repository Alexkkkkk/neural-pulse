# ИСПОЛЬЗУЕМ ЯВНЫЙ ОБРАЗ ПИТОНА
FROM python:3.11-slim

# Установка системных зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Отключаем создание лишних файлов
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Ставим библиотеки
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем проект
COPY . .

# Открываем порт
EXPOSE 3000

# ГЛАВНОЕ: Используем ENTRYPOINT в формате списка
ENTRYPOINT ["python3", "main.py"]
