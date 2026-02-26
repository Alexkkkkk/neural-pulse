import os, asyncio, sqlite3, uvicorn, logging, time, json
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, LabeledPrice

# --- КОНФИГУРАЦИЯ ЭКОНОМИКИ ---
PLAYER_LEVELS = {
    1: {"name": "Новичок", "price": 0, "tap": 1},
    2: {"name": "Стажер", "price": 1000, "tap": 5},
    3: {"name": "Фрилансер", "price": 5000, "tap": 15},
    4: {"name": "Специалист", "price": 15000, "tap": 40},
    5: {"name": "Менеджер", "price": 45000, "tap": 100},
    6: {"name": "Тимлид", "price": 120000, "tap": 250},
    7: {"name": "Инвестор", "price": 350000, "tap": 600},
    8: {"name": "Миллионер", "price": 1000000, "tap": 1500},
    9: {"name": "Владелец ТГ", "price": 2500000, "tap": 4000},
    10: {"name": "CEO", "price": 6000000, "tap": 10000},
}

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "game.db"
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru" 

bot = Bot(token=TOKEN)
dp = Dispatcher()
logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Инициализация БД
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
                        (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                         click_lvl INTEGER DEFAULT 1, referrer_id TEXT)''')
        conn.commit()
    # Запуск бота параллельно с API
    polling_task = asyncio.create_task(dp.start_polling(bot))
    yield
    polling_task.cancel()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Настройка папки со статикой
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(STATIC_DIR))

# --- API ---

@app.get("/api/config")
async def get_config():
    return {"levels": PLAYER_LEVELS}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row:
            conn.execute("INSERT INTO users (id, balance, click_lvl) VALUES (?, 0, 1)", (user_id,))
            conn.commit()
            return {"balance": 0, "click_lvl": 1}
        return {"balance": row[0], "click_lvl": row[1]}

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    uid, clicks = str(data.get("user_id")), int(data.get("clicks", 0))
    # Анти-чит: ограничение кликов за один запрос (раз в 2 сек)
    if clicks > 200: clicks = 200 
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (clicks, uid))
        conn.commit()
