import os, asyncio, sqlite3, uvicorn, logging, time, sys, traceback, random
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from functools import wraps
from aiogram import Bot, Dispatcher, types, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update

# --- НАСТРОЙКИ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru" 
WEBHOOK_PATH = "/webhook"
WEBHOOK_URL = f"https://{MY_DOMAIN}{WEBHOOK_PATH}"

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = Path("/app/data") 
DB_PATH = DATA_DIR / "game.db"

# КОНФИГУРАЦИЯ ДЖЕКПОТА
JACKPOT_CHANCE = 0.0001  # Шанс 1 из 10,000
JACKPOT_INCREMENT = 10   # Рост за каждое сохранение

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger("NEURAL_PULSE")

# --- КЛАСС ОТВЕТОВ ---
class HTTPWrapper:
    @staticmethod
    def success(data: dict = None, message: str = "ok"):
        return {"status": "ok", "message": message, "data": data if data else {}}
    @staticmethod
    def error(message: str = "error", status_code: int = 500):
        return JSONResponse(status_code=status_code, content={"status": "error", "message": message})

def api_error_handler(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try: return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"API Error: {e}\n{traceback.format_exc()}")
            return HTTPWrapper.error(message=str(e))
    return wrapper

class SaveData(BaseModel):
    user_id: int
    score: int
    league_id: int = 1
    click_lvl: int = 1
    bot_lvl: int = 0

# --- ИНИЦИАЛИЗАЦИЯ БОТА ---
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- ЖИЗНЕННЫЙ ЦИКЛ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(exist_ok=True, parents=True)
    with sqlite3.connect(str(DB_PATH)) as conn:
        # Таблица пользователей
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
             click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
             last_collect INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1)''')
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bal ON users(balance DESC)")
        
        # Таблица системных статов (ДЖЕКПОТ)
        conn.execute("CREATE TABLE IF NOT EXISTS system_stats (key TEXT PRIMARY KEY, value INTEGER)")
        conn.execute("INSERT OR IGNORE INTO system_stats (key, value) VALUES ('jackpot', 0)")
        conn.commit()
    
    await bot.set_webhook(url=WEBHOOK_URL, drop_pending_updates=True)
    logger.info(f"🚀 Webhook active: {WEBHOOK_URL}")
    yield
    await bot.delete_webhook()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- ЭНДПОИНТ ДЛЯ TELEGRAM ---
@app
