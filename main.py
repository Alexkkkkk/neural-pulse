import os, asyncio, sqlite3, uvicorn, logging, time, sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКИ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "game.db"

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger("PULSE")

class SaveData(BaseModel):
    user_id: int
    score: int
    league_id: int = 1
    click_lvl: int = 1
    bot_lvl: int = 0

# --- БД И ЖИЗНЕННЫЙ ЦИКЛ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(exist_ok=True)
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
             click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
             last_collect INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1)''')
    
    bot_task = asyncio.create_task(dp.start_polling(bot))
    logger.info("✅ Бот и БД запущены")
    yield
    bot_task.cancel()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ЭНДПОИНТЫ ---
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            conn.execute("INSERT INTO users (id, balance, last_collect) VALUES (?, 1000, ?)", (user_id, now))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "league_id": 1, "offline_profit": 0}}
        
        user = dict(row)
        off_time = now - user['last_collect']
        profit = min((off_time * user['bot_lvl']), 50000) if user['bot_lvl'] > 0 else 0
        return {"status": "ok", "data": {**user, "offline_profit": profit}}

@app.post("/api/save")
async def save_progress(data: SaveData):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("""INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect, league_id) 
            VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET 
            balance=excluded.balance, click_lvl=excluded.click_lvl, 
            bot_lvl=excluded.bot_lvl, last_collect=?, league_id=excluded.league_id""", 
            (str(data.user_id), data.score, data.click_lvl, data.bot_lvl, now, data.league_id, now))
        conn.commit()
    return {"status": "ok"}

# --- СТАТИКА (ПОДКЛЮЧАЕМ ПОСЛЕ API) ---
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

# --- БОТ ---
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

@dp.message(F.text == "/start")
async def start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Играть", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>Neural Pulse</b> запущен!", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
