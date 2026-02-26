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

# --- НАСТРОЙКА ---
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")

bot = Bot(token=TOKEN)
dp = Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Инициализация и ОЧИСТКА БД
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
            conn.execute("DELETE FROM users") 
            conn.commit()
        logger.info("🗄️ База очищена.")
    except Exception as e:
        logger.error(f"DB Error: {e}")

    # 2. Очистка очереди и запуск бота
    polling_task = asyncio.create_task(dp.start_polling(bot))
    await bot.delete_webhook(drop_pending_updates=True) 
    logger.info("✅ Бот запущен (очистка выполнена).")
    
    yield
    
    # 3. Закрытие
    polling_task.cancel()
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=[str(BASE_DIR), str(STATIC_DIR)])

# --- API ---

@app.get("/")
async def serve_game(request: Request):
    try:
        # Добавляем Cache-Control, чтобы браузер не хранил старую версию HTML
        response = templates.TemplateResponse("index.html", {"request": request})
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response
    except:
        return Response(content="index.html not found", status_code=404)

# Заглушка для favicon, чтобы у
