FROM python:3.11-slim

WORKDIR /app

# 1. Установка зависимостей (твои версии сохранены)
# Добавлен FastAPI и Uvicorn для работы веб-сервера
RUN pip install --no-cache-dir \
    aiogram==3.4.1 \
    aiohttp==3.9.3 \
    python-dotenv==1.0.1 \
    requests==2.32.5 \
    fastapi \
    uvicorn

# 2. Копируем файлы проекта
COPY . .

# 3. Настройка прав для базы данных
RUN mkdir -p /app/data && chmod 777 /app/data

# 4. Создаем index.html (для WebApp и устранения ошибки Not Found)
RUN echo '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><script src="https://telegram.org/js/telegram-web-app.js"></script><style>body{font-family:sans-serif;background:#0f172a;color:white;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0}h1{color:#38bdf8}.card{background:#1e293b;padding:2rem;border-radius:1.5rem;border:1px solid #334155}</style></head><body><div class="card"><h1>💎 NeuralPulse AI</h1><p id="u">Загрузка...</p><button onclick="window.Telegram.WebApp.close()" style="background:#38bdf8;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:bold">Закрыть</button></div><script>const tg=window.Telegram.WebApp;tg.ready();tg.expand();const user=tg.initDataUnsafe?.user;if(user)document.getElementById("u").innerText="Привет, "+user.first_name;</script></body></html>' > /app/index.html

# 5. Создаем http_wrapper.py (запускает и бота, и веб-сервер)
RUN echo 'import os, sys, logging, subprocess, threading, time, uvicorn' > /app/http_wrapper.py && \
    echo 'from fastapi import FastAPI' >> /app/http_wrapper.py && \
    echo 'from fastapi.responses import FileResponse, HTMLResponse' >> /app/http_wrapper.py && \
    echo 'logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")' >> /app/http_wrapper.py && \
    echo 'logger = logging.getLogger(__name__)' >> /app/http_wrapper.py && \
    echo 'app = FastAPI()' >> /app/http_wrapper.py && \
    echo '@app.get("/health")' >> /app/http_wrapper.py && \
    echo 'def health(): return {"status": "ok"}' >> /app/http_wrapper.py && \
    echo '@app.get("/")' >> /app/http_wrapper.py && \
    echo 'async def index():' >> /app/http_wrapper.py && \
    echo '    if os.path.exists("index.html"): return FileResponse("index.html")' >> /app/http_wrapper.py && \
    echo '    return HTMLResponse("<h1>NeuralPulse AI Server is Running</h1>")' >> /app/http_wrapper.py && \
    echo 'def run_bot():' >> /app/http_wrapper.py && \
    echo '    try:' >> /app/http_wrapper.py && \
    echo '        time.sleep(2)' >> /app/http_wrapper.py && \
    echo '        logger.info("Запуск основного процесса бота...")' >> /app/http_wrapper.py && \
    echo '        # Запускаем bot/main.py как в твоем исходном коде' >> /app/http_wrapper.py && \
    echo '        subprocess.run(["python", "bot/main.py"])' >> /app/http_wrapper.py && \
    echo '    except Exception as e: logger.error(f"Bot error: {e}")' >> /app/http_wrapper.py && \
    echo 'if __name__ == "__main__":' >> /app/http_wrapper.py && \
    echo '    port = int(os.getenv("PORT", "3000"))' >> /app/http_wrapper.py && \
    echo '    threading.Thread(target=run_bot, daemon=True).start()' >> /app/http_wrapper.py && \
    echo '    uvicorn.run(app, host="0.0.0.0", port=port)' >> /app/http_wrapper.py

# 6. Открываем порт 3000
EXPOSE 3000

# 7. Запуск через прослойку (wrapper)
CMD ["python", "http_wrapper.py"]
