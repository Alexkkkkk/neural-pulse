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
    # Проверка содержимого static для отладки
    if STATIC_DIR.exists():
        logger.info(f"📂 STATIC_FILES: {os.listdir(str(STATIC_DIR))}")
    
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
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

# Монтируем статику (для картинок и скриптов)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ПРАВКА ТУТ: Указываем Jinja2 искать шаблоны в папке static
templates = Jinja2Templates(directory=str(STATIC_DIR))

# --- API ЭНДПОИНТЫ ---

@app.get("/")
async def serve_game(request: Request):
    # ПРАВКА ТУТ: Проверяем наличие файла именно в STATIC_DIR
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        logger.error(f"🚨 index.html не найден по пути: {index_path}")
        return {"error": f"Файл index.html отсутствует в папке static. Путь: {index_path}"}
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
        if not row: 
            return {"error": "User not found"}
        
        balance, lvl = row[0], row[1]
        cost = lvl * 500
        if balance >= cost:
            new_balance = balance - cost
            new_lvl = lvl + 1
            conn.execute("UPDATE users SET balance = ?, click_lvl = ? WHERE id = ?", (new_balance, new_lvl, uid))
            conn.commit()
            return {
                "status": "ok", 
                "new_balance": new_balance, 
                "new_lvl": new_lvl, 
                "next_cost": new_lvl * 500
            }
        return {"error": "Недостаточно NP!"}

@app.get("/api/all_stats")
async def get_all_stats():
    with sqlite3.connect(str(DB_PATH)) as conn:
        res = conn.execute("SELECT COUNT(*), SUM(balance) FROM users").fetchone()
        return {"total_players": res[0] or 0, "total_balance": res[1] or 0}

# --- ЛОГИКА БОТА ---

@dp.message(F.text.startswith("/start"))
async def start_handler(message: types.Message):
    uid = str(message.from_user.id)
    args = message.text.split()
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE id = ?", (uid,))
        if not c.fetchone():
            ref_id = args[1] if len(args) > 1 else None
            conn.execute("INSERT INTO users (id, balance, click_lvl, referrer_id) VALUES (?, 0, 1, ?)", (uid, ref_id))
            if ref_id:
                conn.execute("UPDATE users SET balance = balance + 5000 WHERE id = ?", (ref_id,))
            conn.commit()

    v = int(datetime.now().timestamp())
