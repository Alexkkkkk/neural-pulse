
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
logger = logging.getLogger("Wrapper")

app = FastAPI()

# Раздача картинок
if os.path.exists("images"):
    app.mount("/images", StaticFiles(directory="images"), name="images")

# Главная страница (твой кликер)
@app.get("/")
async def index():
    return FileResponse("index.html")

@app.get("/health")
def health():
    return {"status": "ok"}

# Запуск бота в отдельном потоке
def run_bot():
    try:
        time.sleep(2)
        logger.info("Запуск бота: bot/main.py")
        subprocess.run([sys.executable, "bot/main.py"])
    except Exception as e:
        logger.error(f"Ошибка бота: {e}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    threading.Thread(target=run_bot, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=port)
