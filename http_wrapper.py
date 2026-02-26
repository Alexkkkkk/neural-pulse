import os, asyncio, sqlite3, uvicorn, logging
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКА ПУТЕЙ ---
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")

# Твои настройки
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"

bot = Bot(token=TOKEN)
dp = Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"📂 BASE_DIR: {BASE_DIR}")
    logger.info(f"📄 Files found: {os.listdir(str(BASE_DIR))}")
    
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            # Расширенная таблица: добавлен referrer_id для друзей
            conn.execute('''CREATE TABLE IF NOT EXISTS users 
                            (id TEXT PRIMARY KEY, 
                             balance INTEGER DEFAULT 0, 
                             click_lvl INTEGER DEFAULT 1,
                             referrer_id TEXT)''')
            conn.commit()
        logger.info("🗄️ База данных готова.")
    except Exception as e:
        logger.error(f"❌ DB ERROR: {e}")

    polling_task = asyncio.create_task(dp.start_polling(bot))
    logger.info(f"✅ Бот Neural Pulse запущен.")
    yield
    polling_task.cancel()
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=str(BASE_DIR))

# --- API ЭНДПОИНТЫ ---

@app.get("/")
async def serve_game(request: Request):
    index_path = BASE_DIR / "index.html"
    if not index_path.exists():
        return {"error": "Файл index.html отсутствует в корне проекта."}
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row:
            conn.execute("INSERT INTO users (id, balance, click_lvl) VALUES (?, 0, 1)", (user_id,))
            conn.commit()
            return {"balance": 0, "click_lvl": 1}
        return {"balance": row[0], "click_lvl": row[1]}

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    uid, clicks = str(data.get("user_id")), int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (clicks, uid))
        conn.commit()
    return {"status": "ok"}

@app.post("/api/buy_boost")
async def buy_boost(data: dict = Body(...)):
    uid = str(data.get("user_id"))
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl FROM users WHERE id = ?", (uid,))
        row = c.fetchone()
        if not row: return {"error": "User not found"}
        
        balance, lvl = row[0], row[1]
        cost = lvl * 500
        if balance >= cost:
