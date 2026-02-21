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

# Настройка логирования
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("NeuralPulse-Wrapper")

app = FastAPI()

# 1. Раздача картинок (чтобы интерфейс не был пустым)
if os.path.exists("images"):
    app.mount("/images", StaticFiles(directory="images"), name="images")
    logger.info("✅ Папка images подключена")

# 2. Раздача главной страницы игры
@app.get("/")
async def index():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"error": "Файл index.html не найден в корне /app"}

@app.get("/health")
def health():
    return {"status": "ok", "bot_active": True}

# 3. Функция запуска бота
def run_bot():
    try:
        time.sleep(3)  # Даем веб-серверу время на запуск
        bot_script = "bot/main.py"
        if os.path.exists(bot_script):
            logger.info(f"🚀 Запуск процесса бота: {bot_script}")
            subprocess.run([sys.executable, bot_script])
        else:
            logger.error(f"❌ Файл {bot_script} не найден!")
    except Exception as e:
        logger.error(f"❌ Ошибка в работе бота: {e}", exc_info=True)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    # Запускаем бота в отдельном потоке (Thread)
    threading.Thread(target=run_bot, daemon=True).start()
    # Запускаем основной веб-сервер
    logger.info(f"🌐 Сервер NeuralPulse запущен на порту {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
