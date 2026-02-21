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
logging.basicConfig(
    level=logging.INFO, 
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("NeuralPulse-Wrapper")

app = FastAPI()

# --- 1. СИНХРОНИЗАЦИЯ ПЕРЕМЕННЫХ ---
# Гарантируем, что бот увидит токен, под каким бы именем его ни передал хостинг
if not os.getenv("API_TOKEN") and os.getenv("BOT_TOKEN"):
    os.environ["API_TOKEN"] = os.getenv("BOT_TOKEN")

# --- 2. РАЗДАЧА СТАТИКИ И КАРТИНОК ---
# Используем безопасный путь
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
images_path = os.path.join(BASE_DIR, "images")

if os.path.exists(images_path):
    app.mount("/images", StaticFiles(directory=images_path), name="images")
    logger.info(f"✅ Статика подключена: {images_path}")
else:
    logger.warning("⚠️ Папка images не найдена! Проверь структуру проекта.")

# --- 3. ЭНДПОИНТЫ ---
@app.get("/")
async def index():
    index_path = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "index.html not found", "path": index_path}

@app.get("/health")
def health():
    # Возвращаем статус системы
    return {
        "status": "ok", 
        "port": os.getenv("PORT", "3000"),
        "python_version": sys.version.split()[0]
    }

# --- 4. УЛУЧШЕННЫЙ ЗАПУСК БОТА ---
def run_bot():
    bot_script = os.path.join(BASE_DIR, "bot", "main.py")
    try:
        time.sleep(3) # Даем серверу время забиндить порт
        if not os.path.exists(bot_script):
            logger.error(f"❌ Файл бота не найден: {bot_script}")
            return

        logger.info(f"🚀 Запуск бота из {bot_script}...")
        
        # Используем subprocess.Popen, чтобы не блокировать поток намертво
        # и иметь возможность прочитать ошибки
        process = subprocess.Popen(
            [sys.executable, bot_script],
            stdout=sys.stdout,
            stderr=sys.stderr,
            env=os.environ.copy()
        )
        process.wait()
    except Exception as e:
        logger.error(f"❌ Ошибка в процессе бота: {e}", exc_info=True)

# --- 5. СТАРТ ---
if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    
    # Запускаем бота в фоне
    bot_thread = threading.Thread(target=run_bot, daemon=True)
    bot_thread.start()
    
    logger.info(f"🌐 Сервер запущен на 0.0.0.0:{port}")
    # Запускаем FastAPI
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
    
