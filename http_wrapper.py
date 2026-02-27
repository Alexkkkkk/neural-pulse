import os, asyncio, sqlite3, uvicorn, logging, time
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import FileResponse  # Это заменяет flask.send_from_directory
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКА ЛОГИРОВАНИЯ ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(name)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("NEURAL_PULSE")

# --- КОНФИГУРАЦИЯ ---
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"

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

BOT_UPGRADE_COSTS = {
    0: {"price": 25000, "mult": 1},
    1: {"price": 100000, "mult": 3},
    2: {"price": 500000, "mult": 8},
    3: {"price": 2000000, "mult": 20},
    4: {"price": 10000000, "mult": 50}
}

TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"

bot = Bot(token=TOKEN)
dp = Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🛠️ Инициализация БД...")
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
                        (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                         click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
                         last_collect INTEGER DEFAULT 0, referrer_id TEXT)''')
        conn.commit()
    
    polling_task = asyncio.create_task(dp.start_polling(bot))
    logger.info("✅ Запуск завершен.")
    yield
    polling_task.cancel()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=str(STATIC_DIR))

# --- ОБРАБОТКА FAVICON (Аналог send_from_directory для FastAPI) ---
@app.get('/favicon.ico', include_in_schema=False)
async def favicon():
    # Путь к твоей иконке: static/images/unnamed4.png
    icon_path = STATIC_DIR / "images" / "unnamed4.png"
    if icon_path.exists():
        return FileResponse(icon_path)
    return {"status": "not found"}

# --- API ЭНДПОИНТЫ ---

@app.get("/")
async def serve_game(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

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
        offline_profit = 0
        
        if bot_lvl > 0 and last_collect > 0:
            seconds_passed = min(now - last_collect, 28800) 
            tap_power = PLAYER_LEVELS.get(click_lvl, PLAYER_LEVELS[1])["tap"]
            mult = BOT_UPGRADE_COSTS.get(bot_lvl - 1, {"mult": 1})["mult"]
            offline_profit = int(seconds_passed * tap_power * mult)
            balance += offline_profit

        conn.execute("UPDATE users SET balance = ?, last_collect = ? WHERE id = ?", (balance, now, user_id))
        conn.commit()
        return {"balance": balance, "click_lvl": click_lvl, "bot_lvl": bot_lvl, "offline_profit": offline_profit}

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    uid, clicks = str(data.get("user_id")), int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET balance = balance + ?, last_collect = ? WHERE id = ?", (clicks, int(time.time()), uid))
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
        if next_lvl not in PLAYER_LEVELS: return {"error": "MAX LEVEL"}
        
        cost = PLAYER_LEVELS[next_lvl]["price"]
        if balance >= cost:
            conn.execute("UPDATE users SET balance = balance - ?, click_lvl = ?, last_collect = ? WHERE id = ?", 
                         (cost, next_lvl, int(time.time()), uid))
            conn.commit()
            return {"status": "ok", "new_balance": balance - cost, "new_lvl": next_lvl}
        return {"error": "Недостаточно NP!"}

@app.post("/api/buy_bot_np")
async def buy_bot_np(data: dict = Body(...)):
    uid = str(data.get("user_id"))
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, bot_lvl FROM users WHERE id = ?", (uid,))
        res = c.fetchone()
        if not res: return {"error": "User not found"}
        
        balance, current_bot_lvl = res
        if current_bot_lvl not in BOT_UPGRADE_COSTS:
            return {"error": "MAX BOT LEVEL"}
        
        cost = BOT_UPGRADE_COSTS[current_bot_lvl]["price"]
        if balance >= cost:
            new_bot_lvl = current_bot_lvl + 1
            conn.execute("UPDATE users SET balance = balance - ?, bot_lvl = ?, last_collect = ? WHERE id = ?", 
                         (cost, new_bot_lvl, int(time.time()), uid))
            conn.commit()
            logger.info(f"🤖 [AUTO-BOT] {uid} купил уровень {new_bot_lvl}")
            return {"status": "ok", "new_balance": balance - cost, "new_bot_lvl": new_bot_lvl}
        return {"error": "Недостаточно NP!"}

@app.get("/api/all_stats")
async def get_all_stats():
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        total_players = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        total_balance = c.execute("SELECT SUM(balance) FROM users").fetchone()[0] or 0
        return {"total_players": total_players, "total_balance": total_balance}

@dp.message(F.text.startswith("/start"))
async def start_handler(message: types.Message):
    uid = str(message.from_user.id)
    args = message.text.split()
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE id = ?", (uid,))
        if not c.fetchone():
            ref_id = args[1] if len(args) > 1 and args[1] != uid else None
            conn.execute("INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect, referrer_id) VALUES (?, 1000, 1, 0, ?, ?)", 
                         (uid, int(time.time()), ref_id))
            if ref_id:
                conn.execute("UPDATE users SET balance = balance + 50000 WHERE id = ?", (ref_id,))
                try: await bot.send_message(ref_id, "💎 Друг зашел по ссылке! +50,000 NP!")
                except: pass
            conn.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await message.answer(f"Привет! 🚀\nГотов майнить NP?", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
