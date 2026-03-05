# Используем стабильный и легкий образ Python
FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Настройки Python: 
# 1. Отключаем кэш .pyc (меньше мусора)
# 2. Отключаем буферизацию (логи появляются в панели Bothost мгновенно)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Устанавливаем системные зависимости (добавлен sqlite3 для отладки БД)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Копируем зависимости
COPY requirements.txt .

# Устанавливаем библиотеки (объединено для уменьшения веса слоев)
RUN pip install --no-cache-dir --upgrade pip wheel && \
    pip install --no-cache-dir -r requirements.txt

# Копируем весь проект (сохраняем твой дизайн и index.html в /static)
COPY . .

# Проверяем структуру файлов в логах сборки
RUN ls -R /app/static

# Выставляем порт 3000 (стандарт Bothost)
EXPOSE 3000

# ЗАПУСК:
# Добавлен параметр --workers 1, так как SQLite не любит многопоточность на запись
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000", "--proxy-headers", "--forwarded-allow-ips", "*", "--workers", "1"]
