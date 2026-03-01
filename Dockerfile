FROM python:3.11-slim
WORKDIR /app
# Явно ставим зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Копируем проект
COPY . .
# Открываем порт
EXPOSE 3000
# ГЛАВНОЕ: Используем ENTRYPOINT в JSON-формате (это сложнее переопределить)
ENTRYPOINT ["python3", "main.py"]
