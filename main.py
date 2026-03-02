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

# Словарь для хранения времени начала сессии в памяти (для логов)
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

class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== ПРОВЕРКА ЗАПУСКА ===")
    if (STATIC_DIR / "index.html").exists():
        logger.info("✅ index.html на месте")
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        # Добавляем колонку last_active, если её нет
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, click_lvl INTEGER DEFAULT 1,
             last_active INTEGER DEFAULT 0)''')
        conn.commit()
    logger.info("✅ База данных готова")

    await bot.set_webhook(url=f"https://{MY_DOMAIN}/webhook", drop_pending_updates=True)
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    path = request.url.path
    response = await call_next(request)
    if path.startswith("/static") or path == "/":
        status = "🟢" if response.status_code == 200 else "🔴"
        logger.info(f"{status} Ресурс: {path} [{response.status_code}]")
    return response

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    # Фиксируем время начала сессии
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
    
    # Считаем длительность сессии для лога
    duration = int(now - session_starts.get(uid, now))
    
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("UPDATE users SET balance=?, click_lvl=?, last_active=? WHERE id=?", 
                         (data.score, data.click_lvl, int(now), uid))
            conn.commit()
            
            logger.info(f"💾 СОХРАНЕНИЕ: User {uid} | Баланс: {data.score} | Сессия: {duration} сек.")
            return {"status": "ok"}
    except Exception as e:
        logger.error(f"❌ Ошибка сохранения {uid}: {e}")
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
    await m.answer(f"<b>Neural Pulse AI</b>\nЗапускай систему и начни майнинг!", reply_markup=kb)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
