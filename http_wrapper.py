import os, asyncio, sqlite3, uvicorn, logging, time
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

bot = Bot(token=TOKEN)
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1
    bot_lvl: int = 0

@asynccontextmanager
async def lifespan(app: FastAPI):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
                        (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                         click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
                         last_collect INTEGER DEFAULT 0)''')
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

# --- УТИЛИТЫ ---

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    icon_path = STATIC_DIR / "images" / "unnamed4.png"
    if icon_path.exists():
        return FileResponse(icon_path)
    return Response(status_code=204)

# ИСПРАВЛЕНИЕ: Обработка запроса иконки из папки static
@app.get("/static/favicon.ico", include_in_schema=False)
async def static_favicon():
    return await favicon()

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# --- API ---

@app.get("/")
async def serve_game():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"error": "index.html not found"}

@app.post("/api/save")
async def save_progress(data: SaveData):
    uid = str(data.user_id)
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("""
            INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect) 
            VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(id) DO UPDATE SET 
                balance = ?, 
                click_lvl = ?, 
                bot_lvl = ?, 
                last_collect = ?
        """, (uid, data.score, data.click_lvl, data.bot_lvl, int(time.time()), 
              data.score, data.click_lvl, data.bot_lvl, int(time.time())))
        conn.commit()
    return {"status": "success"}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl, bot_lvl, last_collect FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        
        if not row:
            conn.execute("INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect) VALUES (?, 1000, 1, 0, ?)", (user_id, now))
            conn.commit()
            return {"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "offline_profit": 0}
        
        bal, c_lvl, b_lvl, last_c = row["balance"], row["click_lvl"], row["bot_lvl"], row["last_collect"]
        offline_profit = 0
        if b_lvl > 0:
            seconds = min(now - last_c, 28800)
            offline_profit = seconds * b_lvl * 2
            bal += offline_profit
            conn.execute("UPDATE users SET balance = ?, last_collect = ? WHERE id = ?", (bal, now, user_id))
            conn.commit()

        return {"balance": bal, "click_lvl": c_lvl, "bot_lvl": b_lvl, "offline_profit": offline_profit}

@app.get("/api/leaderboard")
async def get_leaderboard(user_id: str = None):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row 
        c = conn.cursor()
        c.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10")
        top_rows = c.fetchall()
        top10 = [{"user_id": row["id"], "score": row["balance"]} for row in top_rows]
        
        user_rank = 0
        if user_id:
            c.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
            user_data = c.fetchone()
            if user_data:
                c.execute("SELECT COUNT(*) + 1 FROM users WHERE balance > ?", (user_data["balance"],))
                user_rank = c.fetchone()[0]

        return {"top10": top10, "user_rank": user_rank}

# --- БОТ ---
@dp.message(F.text.startswith("/start"))
async def start_handler(message: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await message.answer(f"Привет, {message.from_user.first_name}! 🚀\nТвой нейронный пульс готов к разгону.", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
