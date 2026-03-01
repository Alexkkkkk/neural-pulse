import os, sys, asyncio, sqlite3, uvicorn, logging, random, time
from datetime import date, timedelta
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

# --- НАСТРОЙКИ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru" # Замени на свой актуальный домен
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "game.db"

logging.basicConfig(level=logging.INFO)
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1
    bot_lvl: int = 0

# --- ИНИЦИАЛИЗАЦИЯ БД И WEBHOOK ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создаем БД и таблицы
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
             bot_lvl INTEGER DEFAULT 0, last_bonus_date TEXT DEFAULT '', 
             streak_days INTEGER DEFAULT 0, last_collect INTEGER DEFAULT 0, referrer TEXT)''')
        conn.execute("CREATE TABLE IF NOT EXISTS system_stats (key TEXT PRIMARY KEY, value INTEGER)")
        conn.execute("INSERT OR IGNORE INTO system_stats VALUES ('jackpot', 500000)")
        conn.commit()
    
    # Настройка Webhook для Telegram
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    logging.info(f"Webhook set to: {webhook_url}")
    yield
    await bot.delete_webhook()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- BOT HANDLERS ---
@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 ИГРАТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(
        f"<b>Добро пожаловать в Neural Pulse, {m.from_user.first_name}!</b>\n\n"
        f"Тапай, копи NP и выигрывай джекпот.", 
        reply_markup=kb
    )

# --- API ENDPOINTS ---
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.execute("INSERT INTO users (id, balance, last_collect) VALUES (?, 1000, ?)", 
                         (user_id, int(time.time())))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "bot_lvl": 0}}
        return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("UPDATE users SET balance=?, click_lvl=?, bot_lvl=? WHERE id=?", 
                         (data.score, data.click_lvl, data.bot_lvl, str(data.user_id)))
            # Увеличиваем джекпот при каждом сохранении
            conn.execute("UPDATE system_stats SET value = value + 10 WHERE key='jackpot'")
            jack = conn.execute("SELECT value FROM system_stats WHERE key='jackpot'").fetchone()[0]
            conn.commit()
            return {"status": "ok", "jackpot": jack}
    except Exception as e:
        logging.error(f"Save error: {e}")
        return {"status": "error"}

@app.post("/api/daily-bonus")
async def daily_bonus(data: dict):
    uid, today = str(data.get("user_id")), date.today().isoformat()
    rewards = [1000, 2500, 5000, 10000, 20000, 50000, 100000]
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        u = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if not u: return {"status": "error", "message": "User not found"}
        
        if u["last_bonus_date"] == today:
            return {"status": "error", "message": "Бонус уже получен сегодня!"}
        
        streak = (u["streak_days"] % 7) + 1
        reward = rewards[streak-1]
        
        conn.execute("UPDATE users SET balance=balance+?, last_bonus_date=?, streak_days=? WHERE id=?", 
                     (reward, today, streak, uid))
        conn.commit()
        return {"status": "ok", "reward": reward, "streak": streak}

# --- WEBHOOK & STATIC ---
@app.post("/webhook")
async def bot_webhook(request: Request):
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@app.get("/")
async def index():
    return FileResponse(BASE_DIR / "static" / "index.html")

# Раздача статики (картинки, стили)
static_path = BASE_DIR / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
