import os, asyncio, sqlite3, uvicorn, logging, time
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКА ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger("NEURAL_PULSE")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"

TOKEN = "8257287930:AAG3tTP9uCtv5GcaqLA_piMqFjzFvA1PExM"
MY_DOMAIN = "np.bothost.ru"

# Данные по лигам и джекпотам
BASE_TARGETS = [
    600000, 900000, 1400000, 2100000, 3000000, 4100000, 5400000, 6900000, 8600000, 10500000, 
    12600000, 14900000, 17400000, 20100000, 23000000, 26100000, 29400000, 32900000, 36600000, 40500000
]
# Текущие джекпоты (храним в памяти для скорости)
current_server_jackpots = list(BASE_TARGETS)

bot = Bot(token=TOKEN)
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int
    league_id: int
    click_lvl: int = 1
    bot_lvl: int = 0
    won_jackpot: bool = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Инициализация БД (добавлена колонка league_id)
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
                        (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                         click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
                         last_collect INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1)''')
        conn.execute("CREATE INDEX IF NOT EXISTS idx_balance ON users (balance DESC)")
        conn.commit()
    
    bot_task = asyncio.create_task(dp.start_polling(bot))
    yield
    bot_task.cancel()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- СТАТИКА ---
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_game():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Neural Pulse: index.html not found</h1>"

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    icon_path = STATIC_DIR / "images" / "unnamed4.png"
    return FileResponse(icon_path) if icon_path.exists() else Response(status_code=204)

# --- API ---

@app.post("/api/save")
async def save_progress(data: SaveData):
    uid = str(data.user_id)
    now = int(time.time())
    idx = max(0, min(data.league_id - 1, 19))
    
    # Логика джекпота
    if data.won_jackpot:
        current_server_jackpots[idx] = 0
        logger.info(f"JACKPOT WON by {uid} in league {data.league_id}")
    else:
        # Наполняем джекпот от кликов
        current_server_jackpots[idx] += (data.league_id * 0.1)

    with sqlite3.connect(str(DB_PATH)) as conn:
        score_int = int(data.score)
        conn.execute("""
            INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect, league_id) 
            VALUES (?, ?, ?, ?, ?, ?) 
            ON CONFLICT(id) DO UPDATE SET 
                balance = ?, click_lvl = ?, bot_lvl = ?, last_collect = ?, league_id = ?
        """, (uid, score_int, data.click_lvl, data.bot_lvl, now, data.league_id,
              score_int, data.click_lvl, data.bot_lvl, now, data.league_id))
        conn.commit()

    return {
        "status": "success",
        "global_jackpot": round(current_server_jackpots[idx], 1),
        "target": BASE_TARGETS[idx]
    }

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl, bot_lvl, last_collect, league_id FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        
        if not row:
            conn.execute("INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect, league_id) VALUES (?, 1000, 1, 0, ?, 1)", (user_id, now))
            conn.commit()
            return {"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "offline_profit": 0, "league_id": 1}
        
        bal, c_lvl, b_lvl, last_c, l_id = row["balance"], row["click_lvl"], row["bot_lvl"], row["last_collect"], row["league_id"]
        
        offline_profit = 0
        if b_lvl > 0 and last_c > 0:
            seconds = min(now - last_c, 28800) 
            if seconds > 60:
                offline_profit = int(seconds * b_lvl * 1.5)
                bal += offline_profit
                conn.execute("UPDATE users SET balance = ?, last_collect = ? WHERE id = ?", (bal, now, user_id))
                conn.commit()

        return {
            "balance": bal, "click_lvl": c_lvl, "bot_lvl": b_lvl, 
            "league_id": l_id, "offline_profit": offline_profit
        }

# --- БОТ ---
@dp.message(F.text.startswith("/start"))
async def start_handler(message: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await message.answer(f"Привет, {message.from_user.first_name}! 🚀\nТвой нейронный пульс готов к разгону.", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
