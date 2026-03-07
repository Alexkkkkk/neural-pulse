FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080
# Сокеты лучше работают в один поток для стабильности соединений
CMD ["python", "server.py"]
