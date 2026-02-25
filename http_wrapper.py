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

TOKEN = "8257287930:AAG13nP9Qgzeu-i3UU4d1sB3Kfaid2oPF-c"
MY_DOMAIN = "ai.bothost.ru"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")

bot = Bot(token=TOKEN)
dp = Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Инициализация БД
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
    
    logger.info("🗄️ [DB]: База инициализирована.")
    
    # Запуск бота
    polling_task = asyncio.create_task(dp.start_polling(bot))
    yield
    # Остановка
    polling_task.cancel()
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- МОНТИРОВАНИЕ СТАТИКИ ---
if IMAGES_DIR.exists():
    app.mount("/static/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=str(BASE_DIR))

# --- API ДЛЯ ИГРЫ ---

@app.get("/")
async def serve_game(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    # Заглушка, чтобы логи были чистыми
    return Response(status_code=204)

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return {"balance": row[0] if row else 0}

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    # Твои логи показывают, что фронтенд шлет данные сюда
    uid = str(data.get("user_id"))
    clicks = int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute(
            "INSERT INTO users (id, balance) VALUES (?, ?) "
            "ON CONFLICT(id) DO UPDATE SET balance = balance + ?", 
            (uid, clicks, clicks)
        )
    return {"status": "ok", "new_balance": "updated"}

# --- ЛОГИКА БОТА ---

@dp.message(F.text == "/start")
async def start_handler(message: types.Message):
    v = int(datetime.now().timestamp())
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/?v={v}"))
    ]])
    await message.answer(f"Привет, {message.from_user.first_name}! Твоя нейросеть готова к майнингу.", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
