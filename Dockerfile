# Используем более свежий и быстрый образ
FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Настройки Python для Docker (отключаем буферизацию логов и создание .pyc)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Устанавливаем минимальные системные зависимости
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем только файл зависимостей (для кэширования слоев)
COPY requirements.txt .

# Устанавливаем библиотеки (wheel ускоряет сборку)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir wheel && \
    pip install --no-cache-dir -r requirements.txt

# Копируем весь проект
COPY . .

# Проверяем структуру (важно для дебага пути к static/index.html)
RUN ls -R /app

# Открываем порт
EXPOSE 3000

# Запускаем через uvicorn напрямую (это стабильнее, чем через python main.py)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000", "--workers", "1", "--no-access-log"]
