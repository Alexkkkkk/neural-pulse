import os
import sys
import logging
import subprocess
import threading
import time
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Логирование
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("NeuralPulse-Wrapper")

app = FastAPI()

# 1. Раздача картинок (чтобы работали unnamed(3).jpg и т.д.)
if os.path.exists("images"):
    app.mount("/images", StaticFiles(directory="images"), name="images")

# 2. Раздача главной страницы (твой index.html)
@app.get("/")
async def index():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"error": "Файл index.html не найден в корне /app"}

@app.get("/health")
def health():
    return {"status": "ok"}

# 3. Функция запуска бота
def run_bot():
    try:
        time.sleep(2) # Даем серверу прогрузиться
        logger.info("Запуск бота: bot/main.py")
        # Исправляем путь: если COPY . ., то путь будет bot/main.py
        subprocess.run([sys.executable, "bot/main.py"])
    except Exception as e:
        logger.error(f"Ошибка при запуске бота: {e}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    threading.Thread(target=run_bot, daemon=True).start()
    logger.info(f"Сервер NeuralPulse запущен на порту {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
