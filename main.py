import os, sys, asyncio, sqlite3, uvicorn, logging, random, time
from datetime import date, timedelta
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
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
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"

session_starts = {}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(BASE_DIR / "bot_log.txt", encoding="utf-8")
    ]
)
logger = logging.getLogger("NeuralPulse")

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- МОДЕЛИ ---
class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1

# --- ЖИЗНЕННЫЙ ЦИКЛ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== ЗАПУСК СИСТЕМЫ ===")
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, click_lvl INTEGER DEFAULT 1,
             last_active INTEGER DEFAULT 0)''')
        conn.commit()
    logger.info("✅ База данных готова")

    await bot.set_webhook(url=f"https://{MY_DOMAIN}/webhook", drop_pending_updates=True)
    yield
    await bot.session.close()

# --- СОЗДАНИЕ ПРИЛОЖЕНИЯ ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API ---

@app.get("/api/leaderboard")
async def get_leaderboard():
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT id, balance, last_active 
                FROM users 
                ORDER BY balance DESC 
                LIMIT 10
            """)
            rows = cursor.fetchall()
            leaderboard = []
            now = time.time()
            for i, row in enumerate(rows):
                leaderboard.append({
                    "rank": i + 1,
                    "user_id": row["id"],
                    "balance": row["balance"],
                    "is_online": (now - (row["last_active"] or 0)) < 300
                })
            return {"status": "ok", "data": leaderboard}
    except Exception as e:
        logger.error(f"❌ Ошибка лидерборда: {e}")
        return {"status": "error"}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    session_starts[user_id] = time.time()
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.execute("INSERT INTO users (id, balance, last_active) VALUES (?, 1000, ?)", 
                         (user_id, int(time.time())))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1}}
        return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    uid = str(data.user_id)
    now = time.time()
    duration = int(now - session_starts.get(uid, now))
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("UPDATE users SET balance=?, click_lvl=?, last_active=? WHERE id=?", 
                         (data.score, data.click_lvl, int(now), uid))
            conn.commit()
            logger.info(f"💾 SAVE: {uid} | {data.score} NP | Session: {duration}s")
            return {"status": "ok"}
    except Exception as e:
        return {"status": "error"}

@app.post("/webhook")
async def bot_webhook(request: Request):
    body = await request.json()
    update = Update.model_validate(body, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 ИГРАТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>Neural Pulse AI</b>\nСистема готова к работе!", reply_markup=kb)

# --- СТАТИКА ---
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if (STATIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images_fix")

@app.get("/")
async def index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
