import os, asyncio, sqlite3, uvicorn, logging, time
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКА ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger("NEURAL_PULSE")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"

# Справочник уровней
PLAYER_LEVELS = {
    1: {"name": "Новичок", "price": 0, "tap": 1},
    2: {"name": "Стажер", "price": 1000, "tap": 5},
    3: {"name": "Фрилансер", "price": 5000, "tap": 15},
    4: {"name": "Специалист", "price": 15000, "tap": 40},
    5: {"name": "CEO", "price": 100000, "tap": 1000}
}

TOKEN = "8257287930:AAG3tTP9uCtv5GcaqLA_piMqFjzFvA1PExM"
MY_DOMAIN = "np.bothost.ru"

bot = Bot(token=TOKEN)
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Инициализация БД
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
                        (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                         click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
                         last_collect INTEGER DEFAULT 0)''')
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
    # Возвращаем статус 204 (No Content), чтобы убрать ошибки 404 из логов
    return Response(status_code=204)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(STATIC_DIR))

# --- API ---

@app.get("/")
async def serve_game(request: Request):
    from fastapi.responses import FileResponse
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"error": "index.html not found"}

@app.post("/api/save")
async def save_progress(data: SaveData):
    uid = str(data.user_id)
    score = data.score
    logger.info(f"Синхронизация: User {uid}, Score {score}")
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("""
            INSERT INTO users (id, balance, last_collect) 
            VALUES (?, ?, ?) 
            ON CONFLICT(id) DO UPDATE SET balance = ?, last_collect = ?
        """, (uid, score, int(time.time()), score, int(time.time())))
        conn.commit()
    return {"status": "success", "received": score}

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
        
        bal, c_lvl, b_lvl, last_c = row
        offline_profit = 0
        if b_lvl > 0:
            seconds = min(now - last_c, 28800) # Макс 8 часов
            offline_profit = seconds * b_lvl * 2
            bal += offline_profit
            conn.execute("UPDATE users SET balance = ?, last_collect = ? WHERE id = ?", (bal, now, user_id))
            conn.commit()

        return {"balance": bal, "click_lvl": c_lvl, "bot_lvl": b_lvl, "offline_profit": offline_profit}

@app.get("/api/leaderboard")
async def get_leaderboard():
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT id, balance, click_lvl FROM users ORDER BY balance DESC LIMIT 20")
        rows = c.fetchall()
        leaders = [{"display_name": f"ID:{str(r[0])[:5]}", "balance": r[1], "level": PLAYER_LEVELS.get(r[2], PLAYER_LEVELS[1])["name"]} for r in rows]
        return {"leaders": leaders}

# --- БОТ ---
@dp.message(F.text.startswith("/start"))
async def start_handler(message: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await message.answer(f"Привет, {message.from_user.first_name}! 🚀\nТвой нейронный пульс готов к разгону.", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
