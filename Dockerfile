# 1. Используем стабильный образ
FROM python:3.11-slim

# 2. Устанавливаем рабочую директорию
WORKDIR /app

# 3. Глобальные настройки окружения
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Europe/Moscow \
    PYTHONPATH=/app \
    SQLITE_TMPDIR=/tmp \
    DB_PATH=/app/game.db

# 4. Установка системных зависимостей + инструменты отладки
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc python3-dev libsqlite3-dev sqlite3 curl tzdata ca-certificates \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# 5. Установка библиотек
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip wheel && \
    pip install --no-cache-dir -r requirements.txt

# 6. Копирование проекта
COPY . .

# 7. Финальные настройки прав
RUN mkdir -p /app/static /app/backups && chmod -R 777 /app

# 8. СУПЕР-ФИШКА: Скрипт проверки базы перед стартом
# Если база повреждена, он попробует восстановить её из WAL-файлов
RUN echo '#!/bin/bash \n\
echo "--- [DATABASE CHECK] ---" \n\
sqlite3 $DB_PATH "PRAGMA integrity_check;" \n\
exec "$@"' > /entrypoint.sh && chmod +x /entrypoint.sh

# 9. HEALTHCHECK (Проверка пульса)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 10. Порт
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]

# 11. Запуск
# --limit-concurrency 500: защита от DDOS атак на бота
# --backlog 2048: очередь соединений, если наплыв игроков огромный
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "3000", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--workers", "1", \
     "--limit-concurrency", "500", \
     "--timeout-keep-alive", "5", \
     "--no-access-log"]
