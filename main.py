import os, asyncio, sqlite3, uvicorn, logging, time, sys, traceback
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
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
DATA_DIR = Path("/app/data") # Путь для Docker на Bothost
DB_PATH = DATA_DIR / "game.db"

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

# --- ЭНДПОИНТ ДЛЯ TELEGRAM ---
app = FastAPI() # Lifespan ниже

@app.post(WEBHOOK_PATH)
async def bot_webhook(request: Request):
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"status": "ok"}

# --- ЖИЗНЕННЫЙ ЦИКЛ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(exist_ok=True)
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
             click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
             last_collect INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1)''')
    
    # Установка вебхука
    await bot.set_webhook(url=WEBHOOK_URL, drop_pending_updates=True)
    logger.info(f"🚀 Webhook active: {WEBHOOK_URL}")
    yield
    await bot.delete_webhook()

app.router.lifespan_context = lifespan
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ИГРЫ ---
@app.get("/api/balance/{user_id}")
@api_error_handler
async def get_balance(user_id: str, request: Request):
    auth = request.headers.get("Authorization")
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            conn.execute("INSERT INTO users (id, balance, last_collect) VALUES (?, 1000, ?)", (user_id, now))
            conn.commit()
            return HTTPWrapper.success({"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "league_id": 1})
        user = dict(row)
        profit = min(((now - user['last_collect']) * user['bot_lvl']), 50000) if user['bot_lvl'] > 0 else 0
        return HTTPWrapper.success({**user, "offline_profit": profit})

@app.post("/api/save")
@api_error_handler
async def save_progress(data: SaveData):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("""INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect, league_id) 
            VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET 
            balance=excluded.balance, click_lvl=excluded.click_lvl, 
            bot_lvl=excluded.bot_lvl, last_collect=?, league_id=excluded.league_id""", 
            (str(data.user_id), data.score, data.click_lvl, data.bot_lvl, now, data.league_id, now))
        conn.commit()
    return HTTPWrapper.success()

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

@dp.message(F.text == "/start")
async def start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Play Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>System Online, {m.from_user.first_name}!</b>", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
