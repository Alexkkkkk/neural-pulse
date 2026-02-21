import os, sys, logging, subprocess, threading, time, uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Настройка логирования
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("NeuralPulse-Wrapper")

app = FastAPI()

# ИСПРАВЛЕНИЕ ОШИБКИ ПУТЕЙ: Берем текущую директорию скрипта
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Раздача картинок (images/)
images_path = os.path.join(BASE_DIR, "images")
if os.path.exists(images_path):
    app.mount("/images", StaticFiles(directory=images_path), name="images")
    logger.info("✅ Папка images подключена")

# 2. Раздача главной страницы (index.html)
@app.get("/")
async def index():
    path = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(path):
        return FileResponse(path)
    return {"error": "index.html не найден", "searched_at": path}

@app.get("/health")
def health():
    return {"status": "ok"}

# 3. Функция запуска бота
def run_bot():
    try:
        time.sleep(3) 
        # ИСПРАВЛЕНИЕ: Путь к боту теперь всегда корректный
        bot_script = os.path.join(BASE_DIR, "bot", "main.py")
        logger.info(f"🚀 Запуск бота: {bot_script}")
        subprocess.run([sys.executable, bot_script])
    except Exception as e:
        logger.error(f"❌ Критическая ошибка бота: {e}", exc_info=True)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    threading.Thread(target=run_bot, daemon=True).start()
    logger.info(f"🌐 Сервер NeuralPulse запущен на порту {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
