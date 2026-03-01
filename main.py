import os, sqlite3, time, logging
from datetime import date
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

# --- НАСТРОЙКИ (Замени на свои если нужно) ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "game.db"

logging.basicConfig(level=logging.INFO)
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Инициализация БД
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
             last_bonus_date TEXT DEFAULT '', streak_days INTEGER DEFAULT 0)''')
        conn.execute("CREATE TABLE IF NOT EXISTS system_stats (key TEXT PRIMARY KEY, value INTEGER)")
        conn.execute("INSERT OR IGNORE INTO system_stats VALUES ('jackpot', 500000)")
        conn.commit()
    # Установка Webhook
    await bot.set_webhook(url=f"https://{MY_DOMAIN}/webhook", drop_pending_updates=True)
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ---
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.execute("INSERT INTO users (id, balance) VALUES (?, 1000)", (user_id,))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1}}
        return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET balance=?, click_lvl=? WHERE id=?", 
                     (data.score, data.click_lvl, str(data.user_id)))
        conn.execute("UPDATE system_stats SET value = value + 5 WHERE key='jackpot'")
        jack = conn.execute("SELECT value FROM system_stats WHERE key='jackpot'").fetchone()[0]
        conn.commit()
        return {"status": "ok", "jackpot": jack}

@app.post("/api/upgrade")
async def buy_upgrade(data: dict):
    uid = str(data.get("user_id"))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT balance, click_lvl FROM users WHERE id=?", (uid,)).fetchone()
        if not user: return {"status": "error"}
        cost = user['click_lvl'] * 500
        if user['balance'] >= cost:
            new_lvl = user['click_lvl'] + 1
            new_bal = user['balance'] - cost
            conn.execute("UPDATE users SET balance=?, click_lvl=? WHERE id=?", (new_bal, new_lvl, uid))
            conn.commit()
            return {"status": "ok", "new_balance": new_bal, "new_lvl": new_lvl, "next_cost": new_lvl * 500}
        return {"status": "error", "message": "Low balance"}

@app.post("/api/daily-bonus")
async def daily_bonus(data: dict):
    uid, today = str(data.get("user_id")), date.today().isoformat()
    with sqlite3.connect(str(DB_PATH)) as conn:
        u = conn.execute("SELECT last_bonus_date FROM users WHERE id=?", (uid,)).fetchone()
        if u and u[0] == today: return {"status": "error", "message": "Уже получено"}
        reward = 5000
        conn.execute("UPDATE users SET balance=balance+?, last_bonus_date=? WHERE id=?", (reward, today, uid))
        conn.commit()
        return {"status": "ok", "reward": reward}

@app.get("/api/winners")
async def get_winners():
    return {"status": "ok", "data": [{"user_id": "TopPlayer", "amount": 500000}]}

# --- BOT & WEBHOOK ---
@app.post("/webhook")
async def bot_webhook(request: Request):
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🚀 ИГРАТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))]])
    await m.answer(f"<b>Neural Pulse AI</b>\nНачни копить NP прямо сейчас!", reply_markup=kb)

@app.get("/")
async def index(): return FileResponse(BASE_DIR / "static" / "index.html")

# Раздача картинок из папки static
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
