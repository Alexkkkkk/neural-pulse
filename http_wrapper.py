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

# Настройка логов
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("NeuralPulse-Wrapper")

app = FastAPI()

# Маппинг токенов для бота
if not os.getenv("API_TOKEN") and os.getenv("BOT_TOKEN"):
    os.environ["API_TOKEN"] = os.getenv("BOT_TOKEN")

# Раздача картинок (чтобы ядро и логотип работали)
if os.path.exists("images"):
    app.mount("/images", StaticFiles(directory="images"), name="images")

# Главная страница Mini App
@app.get("/")
async def index():
    return FileResponse("index.html")

@app.get("/health")
def health():
    return {"status": "ok"}

# Запуск бота bot/main.py в отдельном процессе
def run_bot():
    try:
        time.sleep(2) # Пауза для старта сервера
        logger.info("Запуск бота: bot/main.py")
        # Важно: путь bot/main.py (без app/ в начале, если COPY . .)
        subprocess.run([sys.executable, "bot/main.py"])
    except Exception as e:
        logger.error(f"Ошибка бота: {e}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    threading.Thread(target=run_bot, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=port)
