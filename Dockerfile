# Используем стабильный и легкий образ Python
FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Настройки Python: 
# 1. Отключаем кэш .pyc (меньше мусора)
# 2. Отключаем буферизацию (логи появляются в панели Bothost мгновенно)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Устанавливаем системные зависимости для сборки библиотек
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем зависимости
COPY requirements.txt .

# Устанавливаем библиотеки
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir wheel && \
    pip install --no-cache-dir -r requirements.txt

# Копируем весь проект (включая папку static с твоим дизайном)
COPY . .

# Проверяем структуру файлов в логах сборки. 
# ВАЖНО: убедись в логах, что index.html лежит по адресу /app/static/index.html
RUN ls -R /app

# Выставляем порт 3000 (стандарт Bothost)
EXPOSE 3000

# ЗАПУСК:
# 1. Убрали --no-access-log, чтобы видеть подключения в реальном времени.
# 2. Добавили --proxy-headers и --forwarded-allow-ips для корректной работы с доменом np.bothost.ru.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000", "--proxy-headers", "--forwarded-allow-ips", "*"]
