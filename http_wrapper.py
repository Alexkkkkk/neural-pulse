import os, asyncio, sqlite3, uvicorn, logging, time
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- 1. ПОЛНАЯ КОНФИГУРАЦИЯ (Из твоего ТЗ) ---
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
    11: {"name": "Магнат", "price": 15000000, "tap": 25000},
    12: {"name": "Крипто-Кит", "price": 40000000, "tap": 60000},
    13: {"name": "Мировой Игрок", "price": 100000000, "tap": 150000},
    14: {"name": "Теневой Лидер", "price": 250000000, "tap": 400000},
    15: {"name": "Хозяин Биржи", "price": 700000000, "tap": 1000000},
    16: {"name": "Олигарх", "price": 2000000000, "tap": 2500000},
    17: {"name": "Пророк ИИ", "price": 5000000000, "tap": 6000000},
    18: {"name": "Колонизатор", "price": 12000000000, "tap": 15000000},
    19: {"name": "Архитектор", "price": 35000000000, "tap": 40000000},
    20: {"name": "GOD MODE", "price": 100000000000, "tap": 100000000}
}

BOT_LEVELS = {
    0: {"multiplier": 0, "price_ton": 0},
    1: {"multiplier": 1.0, "price_ton": 1},
    10: {"multiplier": 8.5, "price_ton": 22},
    20: {"multiplier": 30.0, "price_ton": 100}
}

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "game.db"
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru" 

bot = Bot(token=TOKEN)
dp = Dispatcher()
logging.basicConfig(level=logging.INFO)

# --- 2. БД И ЖИЗНЕННЫЙ ЦИКЛ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
                        (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                         click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
                         last_collect INTEGER DEFAULT 0, referrer_id TEXT)''')
        # Проверка и добавление новых колонок (миграция)
        cursor = conn.execute("PRAGMA table_info(users)")
        cols = [column[1] for column in cursor.fetchall()]
        if "last_collect" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN last_collect INTEGER DEFAULT 0")
        conn.commit()
    
    polling_task = asyncio.create_task(dp.start_polling(bot))
    yield
    polling_task.cancel()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

STATIC_DIR = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(STATIC_DIR))

# --- 3. API ЭНДПОИНТЫ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl, bot_lvl, last_collect FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        
        if not row:
            conn.execute("INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect) VALUES (?, 1000, 1, 0, ?)", (user_id, now))
            conn.commit()
            return {"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "offline_profit": 0}
        
        balance, click_lvl, bot_lvl, last_collect = row
        
        # ЛОГИКА ОФЛАЙН ДОХОДА
        offline_profit = 0
        if bot_lvl > 0 and last_collect > 0:
            seconds_passed = now - last_collect
            # Лимит офлайна 24 часа для баланса игры
            seconds_passed = min(seconds_passed, 86400) 
            
            tap_power = PLAYER_LEVELS.get(click_lvl, PLAYER_LEVELS[1])["tap"]
            multiplier = BOT_LEVELS.get(bot_lvl, BOT_LEVELS[0])["multiplier"]
            
            offline_profit = int(seconds_passed * tap_power * multiplier)
            balance += offline_profit

        # Обновляем время сбора и баланс
        conn.execute("UPDATE users SET balance = ?, last_collect = ? WHERE id = ?", (balance, now, user_id))
        conn.commit()
        
        return {
            "balance": balance, 
            "click_lvl": click_lvl, 
            "bot_lvl": bot_lvl, 
            "offline_profit": offline_profit,
            "dps": PLAYER_LEVELS.get(click_lvl)["tap"] * BOT_LEVELS.get(bot_lvl)["multiplier"]
        }

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
            new_balance = balance - cost
            conn.execute("UPDATE users SET balance = ?, click_lvl = ?, last_collect = ? WHERE id = ?", 
                         (new_balance, next_lvl, int(time.time()), uid))
            conn.commit()
            return {"status": "ok", "new_balance": new_balance, "new_lvl": next_lvl}
        return {"error": "Недостаточно NP"}

@app.post("/api/buy_bot")
async def buy_bot(data: dict = Body(...)):
    uid = str(data.get("user_id"))
    target_lvl = int(data.get("target_lvl", 1))
    if target_lvl not in BOT_LEVELS: return {"error": "Invalid level"}
        
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET bot_lvl = ?, last_collect = ? WHERE id = ?", (target_lvl, int(time.time()), uid))
        conn.commit()
    return {"status": "ok", "new_bot_lvl": target_lvl}

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    uid, clicks = str(data.get("user_id")), int(data.get("clicks", 0))
    if clicks > 1000: clicks = 1000 
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET balance = balance + ?, last_collect = ? WHERE id = ?", (clicks, int(time.time()), uid))
        conn.commit()
    return {"status": "ok"}

@app.get("/")
async def serve_game(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# --- 4. ТЕЛЕГРАМ БОТ ---

@dp.message(F.text.startswith("/start"))
async def start_command(message: types.Message):
    uid = str(message.from_user.id)
    args = message.text.split()
    now = int(time.time())
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE id = ?", (uid,))
        if not c.fetchone():
            ref_id = args[1] if len(args) > 1 and args[1] != uid else None
            # Дарим 1000 NP при регистрации
            conn.execute("INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect, referrer_id) VALUES (?, 1000, 1, 0, ?, ?)", (uid, now, ref_id))
            if ref_id:
                conn.execute("UPDATE users SET balance = balance + 50000 WHERE id = ?", (ref_id,))
                try: await bot.send_message(ref_id, "💎 +50,000 NP! Твой друг присоединился.")
                except: pass
            conn.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 ИГРАТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await message.answer("🧠 Neural Pulse AI: Нажимай и доминируй!", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
