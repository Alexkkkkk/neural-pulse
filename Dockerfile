# Шаг 13: Создание продвинутого http_wrapper.py
RUN echo 'import os, sys, logging, subprocess, threading, time, uvicorn' > /app/http_wrapper.py && \
    echo 'from fastapi import FastAPI' >> /app/http_wrapper.py && \
    echo 'from fastapi.staticfiles import StaticFiles' >> /app/http_wrapper.py && \
    echo 'from fastapi.responses import FileResponse' >> /app/http_wrapper.py && \
    echo 'logging.basicConfig(level=logging.INFO)' >> /app/http_wrapper.py && \
    echo 'logger = logging.getLogger("SERVER")' >> /app/http_wrapper.py && \
    echo 'app = FastAPI()' >> /app/http_wrapper.py && \
    echo 'if os.path.exists("images"): app.mount("/images", StaticFiles(directory="images"), name="images")' >> /app/http_wrapper.py && \
    echo '@app.get("/health")' >> /app/http_wrapper.py && \
    echo 'def health(): return {"status": "ok"}' >> /app/http_wrapper.py && \
    echo '@app.get("/")' >> /app/http_wrapper.py && \
    echo 'async def index(): return FileResponse("index.html")' >> /app/http_wrapper.py && \
    echo 'def run_bot():' >> /app/http_wrapper.py && \
    echo '    try:' >> /app/http_wrapper.py && \
    echo '        time.sleep(2)' >> /app/http_wrapper.py && \
    echo '        subprocess.run(["python", "bot/main.py"])' >> /app/http_wrapper.py && \
    echo '    except Exception as e: logger.error(f"BOT ERROR: {e}")' >> /app/http_wrapper.py && \
    echo 'if __name__ == "__main__":' >> /app/http_wrapper.py && \
    echo '    port = int(os.getenv("PORT", "3000"))' >> /app/http_wrapper.py && \
    echo '    threading.Thread(target=run_bot, daemon=True).start()' >> /app/http_wrapper.py && \
    echo '    uvicorn.run(app, host="0.0.0.0", port=port)' >> /app/http_wrapper.py
