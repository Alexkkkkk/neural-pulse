import os
import asyncio
import sqlite3
import uvicorn
import logging
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКА ПУТЕЙ ---
BASE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = BASE_DIR / "images"
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"

# ТВОЙ АКТУАЛЬНЫЙ ТОКЕН
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")

bot = Bot(token=TOKEN)
dp = Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Инициализация БД (используем абсолютный путь)
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
        logger.info(f"🗄️ [DB]: База инициализирована: {DB_PATH}")
    except Exception as e:
        logger.error(f"❌ [DB ERROR]: {e}")

    # 2. Очистка вебхуков и запуск бота
    polling_task = None
    try:
        logger.info("🤖 [BOT]: Проверка авторизации и запуск polling...")
        await bot.delete_webhook(drop_pending_updates=True)
        polling_task = asyncio.create_task(dp.start_polling(bot))
        logger.info("✅ [BOT]: Поллинг успешно запущен!")
    except Exception as e:
        logger.error(f"❌ [BOT ERROR]: Ошибка старта бота: {e}")
    
    yield
    
    # 3. Завершение работы
    if polling_task:
        polling_task.cancel()
    await bot.session.close()
    logger.info("🛑 [SYSTEM]: Сервис остановлен.")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- МОНТИРОВАНИЕ ФАЙЛОВ ---
# Это позволяет открывать картинки по пути /static/images/...
if IMAGES_DIR.exists():
    app.mount("/static/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Указываем несколько папок для поиска index.html, чтобы избежать TemplateNotFound
templates = Jinja2Templates(directory=[str(BASE_DIR), str(STATIC_DIR)])

# --- API ---

@app.get("/")
async def serve_game(request: Request):
    """Отдает главную страницу игры с проверкой ошибок"""
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        logger.error(f"❌ [RENDER ERROR]: {e}")
        # Если шаблон не найден через Jinja, пробуем отправить файл напрямую
        for alt_path in [BASE_DIR / "index.html", STATIC_DIR / "index.html"]:
            if alt_path.exists():
                from fastapi.responses import FileResponse
                return FileResponse(alt_path)
        return Response(content="Error: index.html not found. Check GitHub root folder.", status_code=404)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
