import os, asyncio, sqlite3, uvicorn, logging, time, json
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- КОНФИГУРАЦИЯ ---
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

# --- НОВОЕ: УРОВНИ БОТОВ ---
BOT_LEVELS = {
    0: {"price_ton": 0, "mult": 0},
    1: {"price_ton": 1, "mult": 1.0},
    2: {"price_ton": 2, "mult": 1.5},
    3: {"price_ton": 3, "mult": 2.0},
    4: {"price_ton": 5, "mult": 2.5},
    5: {"price_ton": 7, "mult": 3.0},
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
    # Инициализация БД с поддержкой bot_lvl
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
                        (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                         click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, referrer_id TEXT)''')
        # Проверка на случай, если таблица уже была без bot_lvl
        try:
            conn.execute("ALTER TABLE users ADD COLUMN bot_lvl INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass # Колонка уже есть
        conn.commit()
    logging.info("🗄️ База данных готова (с поддержкой Ботов).")
    
    polling_task = asyncio.create_task(dp.start_polling(bot))
    yield
    polling_task.cancel()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)
(STATIC_DIR / "images").mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(STATIC_DIR))

# --- API ЭНДПОИНТЫ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl, bot_lvl FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row:
            conn.execute("INSERT INTO users (id, balance, click_lvl, bot_lvl) VALUES (?, 0, 1, 0)", (user_id,))
            conn.commit()
            return {"balance": 0, "click_lvl": 1, "bot_lvl": 0}
        return {"balance": row[0], "click_lvl": row[1], "bot_lvl": row[2]}

@app.post("/api/buy_bot")
async def buy_bot(data: dict = Body(...)):
    uid = str(data.get("user_id"))
    target_lvl = int(data.get("target_lvl", 1))
    
    # Простая валидация уровня
    if target_lvl not in BOT_LEVELS:
        return {"error": "Invalid level"}
        
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET bot_lvl = ? WHERE id = ?", (target_lvl, uid))
        conn.commit()
    return {"status": "ok", "new_bot_lvl": target_lvl}

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    uid, clicks = str(data.get("user_id")), int(data.get("clicks", 0))
    if clicks > 500: clicks = 500 
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (clicks, uid))
        conn.commit()
    return {"status": "ok"}

@app.post("/api/buy_boost")
async def buy_boost(data: dict = Body(...)):
    uid = str(data.get("user_id"))
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl FROM users WHERE id = ?", (uid,))
        res = c.fetchone()
        if not res: return {"error": "User not found"}
        balance, current_lvl = res
        next_lvl = current_lvl + 1
        if next_lvl not in PLAYER_LEVELS: return {"error": "MAX LVL"}
        cost = PLAYER_LEVELS[next_lvl]["price"]
        if balance >= cost:
            conn.execute("UPDATE users SET balance = balance - ?, click_lvl = ? WHERE id = ?", (cost, next_lvl, uid))
            conn.commit()
            return {"status": "ok", "new_balance": balance - cost, "new_lvl": next_lvl}
        return {"error": "Недостаточно NP"}

@app.get("/")
async def serve_game(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# --- ЛОГИКА БОТА ---

@dp.message(F.text.startswith("/start"))
async def start_command(message: types.Message):
    uid = str(message.from_user.id)
    args = message.text.split()
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE id = ?", (uid,))
        if not c.fetchone():
            ref_id = args[1] if len(args) > 1 and args[1] != uid else None
            conn.execute("INSERT INTO users (id, balance, click_lvl, bot_lvl, referrer_id) VALUES (?, 1000, 1, 0, ?)", (uid, ref_id))
            if ref_id:
                conn.execute("UPDATE users SET balance = balance + 50000 WHERE id = ?", (ref_id,))
                try: await bot.send_message(ref_id, "💎 +50,000 NP! Твой друг в игре.")
                except: pass
            conn.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 ИГРАТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await message.answer("🧠 Neural Pulse: Нажимай и зарабатывай!", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
