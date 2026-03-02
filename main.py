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
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "game.db"  # Упростил путь для Bothost

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1
    bot_lvl: int = 0

# --- БАЗА ДАННЫХ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Инициализация БД
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
             bot_lvl INTEGER DEFAULT 0, last_bonus_date TEXT DEFAULT '', 
             streak_days INTEGER DEFAULT 0, last_collect INTEGER DEFAULT 0, referrer TEXT)''')
        conn.execute("CREATE TABLE IF NOT EXISTS system_stats (key TEXT PRIMARY KEY, value INTEGER)")
        conn.execute("INSERT OR IGNORE INTO system_stats VALUES ('jackpot', 500000)")
        conn.execute("CREATE TABLE IF NOT EXISTS winners (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, amount INTEGER, ts DATETIME DEFAULT CURRENT_TIMESTAMP)")
        conn.commit()
    
    # Установка вебхука
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    logger.info(f"Webhook set to {webhook_url}")
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.execute("INSERT INTO users (id, balance, last_collect) VALUES (?, 1000, ?)", (user_id, int(time.time())))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "streak_days": 0}}
        return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    LIMIT, START_JACKPOT = 1000000, 500000
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            old = conn.execute("SELECT balance FROM users WHERE id = ?", (str(data.user_id),)).fetchone()
            
            # Начисление в джекпот (1% от профита)
            if old:
                profit = data.score - old["balance"]
                if profit > 0:
                    conn.execute("UPDATE system_stats SET value = value + ? WHERE key='jackpot'", (int(profit*0.01),))
            
            # Проверка джекпота
            jack_val = conn.execute("SELECT value FROM system_stats WHERE key='jackpot'").fetchone()[0]
            winner_id = None
            if jack_val >= LIMIT:
                win_row = conn.execute("SELECT id FROM users ORDER BY RANDOM() LIMIT 1").fetchone()
                if win_row:
                    winner_id = win_row["id"]
                    conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (jack_val, winner_id))
                    conn.execute("INSERT INTO winners (user_id, amount) VALUES (?, ?)", (winner_id, jack_val))
                    conn.execute("UPDATE system_stats SET value = ?", (START_JACKPOT,))
                    jack_val = START_JACKPOT

            conn.execute("UPDATE users SET balance=?, click_lvl=?, bot_lvl=? WHERE id=?", 
                         (data.score, data.click_lvl, data.bot_lvl, str(data.user_id)))
            conn.commit()
            return {"status": "ok", "jackpot": jack_val, "explosion": winner_id is not None}
    except Exception as e: 
        logger.error(f"Save error: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/daily-bonus")
async def daily_bonus(data: dict):
    uid, today = str(data.get("user_id")), date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    rewards = [1000, 2500, 5000, 10000, 25000, 50000, 100000]
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        u = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if not u: return {"status": "error", "message": "User not found"}
        if u["last_bonus_date"] == today: return {"status": "error", "message": "Уже получено"}
        
        new_streak = (u["streak_days"] + 1) if u["last_bonus_date"] == yesterday else 1
        if new_streak > 7: new_streak = 1
        
        reward = rewards[new_streak-1]
        conn.execute("UPDATE users SET balance=balance+?, last_bonus_date=?, streak_days=? WHERE id=?", 
                     (reward, today, new_streak, uid))
        conn.commit()
        return {"status": "ok", "reward": reward, "streak": new_streak}

# --- БОТ ---
@app.post("/webhook")
async def bot_webhook(request: Request):
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    args = m.text.split()
    uid = str(m.from_user.id)
    # Реферальная ссылка вида t.me/bot?start=ref_12345
    ref = args[1].replace("ref_", "") if len(args) > 1 and "ref_" in args[1] else None
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        exists = conn.execute("SELECT id FROM users WHERE id=?", (uid,)).fetchone()
        if not exists:
            conn.execute("INSERT INTO users (id, balance, referrer, last_collect) VALUES (?, 1000, ?, ?)", 
                         (uid, ref, int(time.time())))
            if ref and ref != uid:
                conn.execute("UPDATE users SET balance = balance + 5000 WHERE id=?", (ref,))
                try: await bot.send_message(ref, "🤝 Твой друг зашел в игру! +5,000 NP начислено.")
                except: pass
            conn.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 ИГРАТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>Neural Pulse AI</b>\nПриглашай друзей и забирай джекпот!", reply_markup=kb)

# --- РОУТИНГ ---
@app.get("/")
async def index():
    return FileResponse(BASE_DIR / "static" / "index.html")

# Важно: монтируем статику для картинок и скриптов
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
