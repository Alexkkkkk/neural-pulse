FROM python:3.11-slim

WORKDIR /app

# Копируем только зависимости для кэша
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь проект
COPY . .

# Открываем порт 3000
EXPOSE 3000

# ГЛАВНОЕ: Явно запускаем питон
ENTRYPOINT ["python", "main.py"]
