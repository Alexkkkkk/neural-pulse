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

# 4. Установка системных зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    libsqlite3-dev \
    sqlite3 \
    curl \
    tzdata \
    ca-certificates \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# 5. Установка библиотек
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip wheel && \
    pip install --no-cache-dir -r requirements.txt

# 6. Копирование проекта
COPY . .

# 7. Настройка прав доступа (777 для SQLite WAL режима)
RUN mkdir -p /app/static /app/backups && \
    chmod -R 777 /app && \
    touch /app/game.db && chmod 666 /app/game.db

# 8. ГЕНЕРАЦИЯ ЭНТРИПОИНТА (Исправленный синтаксис)
RUN printf '#!/bin/bash\n\
echo "--- [SYSTEM PRE-START] ---"\n\
rm -f /app/game.db-shm /app/game.db-wal\n\
echo "--- [DATABASE INTEGRITY CHECK] ---"\n\
sqlite3 $DB_PATH "PRAGMA integrity_check;"\n\
echo "--- [STARTING NEURAL PULSE] ---"\n\
exec "$@"\n' > /entrypoint.sh && chmod +x /entrypoint.sh

# 9. HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 10. Порт
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]

# 11. Оптимизированный запуск Uvicorn
# workers=1 критично, так как USER_CACHE живет в памяти одного процесса
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "3000", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--workers", "1", \
     "--backlog", "2048", \
     "--limit-concurrency", "500", \
     "--log-level", "info"]
