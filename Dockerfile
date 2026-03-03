FROM python:3.10-slim
WORKDIR /app
# Системные зависимости
RUN apt-get update && apt-get install -y gcc python3-dev && rm -rf /var/lib/apt/lists/*
# Питон-зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# КОПИРУЕМ ВСЁ (включая index.html)
COPY . .
# Порт и запуск
EXPOSE 3000
CMD ["python", "main.py"]
