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

TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")

bot = Bot(token=TOKEN)
dp = Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- 1. ОЧИСТКА И ИНИЦИАЛИЗАЦИЯ БД ---
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            # Создаем таблицу, если её нет
            conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
            
            # ПОЛНАЯ ОЧИСТКА ДАННЫХ ПРИ СТАРТЕ
            conn.execute("DELETE FROM users") 
            conn.commit()
            
        logger.info(f"🗄️ [DB]: База данных очищена. Все балансы сброшены.")
    except Exception as e:
        logger.error(f"❌ [DB ERROR]: {e}")

    # --- 2. ОЧИСТКА ОЧЕРЕДИ И ЗАПУСК БОТА ---
    polling_task = None
    try:
        # drop_pending_updates=True удаляет все сообщения, присланные пока бот был оффлайн
        await bot.delete_webhook(drop_pending_updates=True)
        polling_task = asyncio.create_task(dp.start_polling(bot))
        logger.info("✅ [BOT]: Очередь обновлений очищена. Поллинг запущен!")
    except Exception as e:
        logger.error(f"❌ [BOT ERROR]: {e}")
    
    yield
    
    # --- 3. КОРРЕКТНОЕ ЗАКРЫТИЕ (CLEANUP) ---
    logger.info("🛑 [SYSTEM]: Запущена процедура выключения...")
    if polling_task:
        polling_task.cancel()
        try:
            await polling_task
        except asyncio.CancelledError:
            pass
            
    await bot.session.close()
    logger.info("👋 [SYSTEM]: Все соединения закрыты.")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# МОНТИРОВАНИЕ СТАТИКИ
if IMAGES_DIR.exists():
    app.mount("/static/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=[str(BASE_DIR), str(STATIC_DIR)])

# --- API ЭНДПОИНТЫ ---

@app.get("/")
async def serve_game(request: Request):
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception:
        for p in [BASE_DIR / "index.html", STATIC_DIR / "index.html"]:
            if p.exists():
                from fastapi.responses import FileResponse
                return FileResponse(p)
        return Response(content="index.html not found", status_code=404)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        return {"balance": row[0] if row else 0}

@app.post("/api/clicks")
