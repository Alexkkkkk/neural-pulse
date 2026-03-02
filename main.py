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

# Улучшенное логирование
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
    bot_lvl: int = 0

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Предварительная проверка файлов
    logger.info("=== ПРОВЕРКА ЗАПУСКА ===")
    if (STATIC_DIR / "index.html").exists():
        logger.info("✅ index.html на месте")
    else:
        logger.error("❌ index.html НЕ НАЙДЕН!")

    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
             bot_lvl INTEGER DEFAULT 0, last_bonus_date TEXT DEFAULT '', 
             streak_days INTEGER DEFAULT 0, last_collect INTEGER DEFAULT 0, 
             referrer TEXT, wallet TEXT)''')
        conn.commit()
    logger.info("✅ База данных подключена")

    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    logger.info(f"🚀 Вебхук активен: {webhook_url}")
    
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

# Middleware для логирования ресурсов
@app.middleware("http")
async def log_requests(request: Request, call_next):
    path = request.url.path
    response = await call_next(request)
    if path.startswith("/static") or path == "/":
        status = "🟢" if response.status_code == 200 else "🔴"
        logger.info(f"{status} Ресурс: {path} [{response.status_code}]")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API ---

@app.get("/favicon.ico")
async def favicon():
    # Заглушка, чтобы не было ошибки 404 в логах
    return Response(status_code=204)

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            logger.info(f"🆕 РЕГИСТРАЦИЯ: Пользователь {user_id} вошел в игру")
            conn.execute("INSERT INTO users (id, balance) VALUES (?, 1000)", (user_id,))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1}}
        return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("UPDATE users SET balance=?, click_lvl=? WHERE id=?", 
                         (data.score, data.click_lvl, str(data.user_id)))
            conn.commit()
            logger.info(f"💾 СОХРАНЕНИЕ: User {data.user_id} -> {data.score} NP")
            return {"status": "ok"}
    except Exception as e:
        logger.error(f"❌ ОШИБКА API /save: {e}")
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
    await m.answer(f"<b>Neural Pulse AI</b>\nДобро пожаловать в систему!", reply_markup=kb)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
