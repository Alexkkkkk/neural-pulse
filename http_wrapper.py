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
    0: {"mult": 0},
    1: {"mult": 1.0}, # 100% от силы тапа в секунду
    # ... можно добавить остальные уровни бота здесь
}

# --- НАСТРОЙКИ ---
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"

TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"

bot = Bot(token=TOKEN)
dp = Dispatcher()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            # Обновленная таблица: добавили bot_lvl и last_collect
            conn.execute('''CREATE TABLE IF NOT EXISTS users 
                            (id TEXT PRIMARY KEY, 
                             balance INTEGER DEFAULT 0, 
                             click_lvl INTEGER DEFAULT 1,
                             bot_lvl INTEGER DEFAULT 0,
                             last_collect INTEGER DEFAULT 0,
                             referrer_id TEXT)''')
            conn.commit()
        logger.info("🗄️ База данных готова.")
    except Exception as e:
        logger.error(f"❌ DB ERROR: {e}")

    polling_task = asyncio.create_task(dp.start_polling(bot))
    yield
    polling_task.cancel()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(STATIC_DIR))

# --- API ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl, bot_lvl, last_collect FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        
        if not row:
            conn.execute("INSERT INTO users (id, balance, click_lvl, last_collect) VALUES (?, 0, 1, ?)", (user_id, now))
            conn.commit()
            return {"balance": 0, "click_lvl": 1, "bot_lvl": 0, "offline_profit": 0}
        
        balance, click_lvl, bot_lvl, last_collect = row
        
        # Расчет офлайн прибыли
        offline_profit = 0
        if bot_lvl > 0 and last_collect > 0:
            seconds = now - last_collect
            # Не более 24 часов прибыли (защита)
            seconds = min(seconds, 86400) 
            
            tap_power = PLAYER_LEVELS.get(click_lvl, PLAYER_LEVELS[1])["tap"]
            multiplier = BOT_LEVELS.get(bot_lvl, BOT_LEVELS[0])["mult"]
            
            offline_profit = int(seconds * tap_power * multiplier)
            if offline_profit > 0:
                balance += offline_profit
                conn.execute("UPDATE users SET balance = ?, last_collect = ? WHERE id = ?", (balance, now, user_id))
                conn.commit()
        else:
            # Если прибыли нет, просто обновляем время входа
            conn.execute("UPDATE users SET last_collect = ? WHERE id = ?", (now, user_id))
            conn.commit()

        return {
            "balance": balance, 
            "click_lvl": click_lvl, 
            "bot_lvl": bot_lvl,
            "offline_profit": offline_profit
        }

@app.post("/api/buy_boost")
async def buy_boost(data: dict = Body(...)):
    uid = str(data.get("user_id"))
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl FROM users WHERE id = ?", (uid,))
        row = c.fetchone()
        if not row: return {"error": "User not found"}
        
        balance, current_lvl = row
        next_lvl = current_lvl + 1
        
        if next_lvl not in PLAYER_LEVELS:
            return {"error": "Достигнут максимум!"}
            
        cost = PLAYER_LEVELS[next_lvl]["price"]
        
        if balance >= cost:
            new_balance = balance - cost
            conn.execute("UPDATE users SET balance = ?, click_lvl = ? WHERE id = ?", (new_balance, next_lvl, uid))
            conn.commit()
            return {
                "status": "ok", 
                "new_balance": new_balance, 
                "new_lvl": next_lvl
            }
        return {"error": f"Нужно {cost} NP!"}

# ОСТАЛЬНЫЕ ЭНДПОИНТЫ (save_clicks, all_stats, start_handler) оставляешь без изменений

@app.get("/")
async def serve_game(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    uid, clicks = str(data.get("user_id")), int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (clicks, uid))
        conn.commit()
    return {"status": "ok"}

@app.get("/api/all_stats")
async def get_all_stats():
    with sqlite3.connect(str(DB_PATH)) as conn:
        res = conn.execute("SELECT COUNT(*), SUM(balance) FROM users").fetchone()
        return {"total_players": res[0] or 0, "total_balance": res[1] or 0}

@dp.message(F.text.startswith("/start"))
async def start_handler(message: types.Message):
    uid = str(message.from_user.id)
    args = message.text.split()
    now = int(time.time())
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE id = ?", (uid,))
        if not c.fetchone():
            ref_id = args[1] if len(args) > 1 else None
            conn.execute("INSERT INTO users (id, balance, click_lvl, referrer_id, last_collect) VALUES (?, 0, 1, ?, ?)", (uid, ref_id, now))
            if ref_id:
                conn.execute("UPDATE users SET balance = balance + 5000 WHERE id = ?", (ref_id,))
            conn.commit()

    v = int(datetime.now().timestamp())
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/?v={v}"))]
    ])
    await message.answer(f"Привет, {message.from_user.first_name}! 🚀\nNeural Pulse готов к запуску.", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
