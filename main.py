import os, asyncio, sqlite3, uvicorn, logging, time, sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# Импорт твоей обертки
try:
    from http_wrapper import HTTPWrapper, api_error_handler
except ImportError:
    # Заглушка на случай отсутствия файла
    def api_error_handler(func): return func
    class HTTPWrapper:
        @staticmethod
        def success(data=None): return {"status": "ok", "data": data}

# --- НАСТРОЙКИ ---
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s | %(levelname)s | %(message)s', 
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NEURAL_PULSE")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "game.db"

# ТВОЙ НОВЫЙ ТОКЕН
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"

class SaveData(BaseModel):
    user_id: int
    score: int
    league_id: int = 1
    click_lvl: int = 1
    bot_lvl: int = 0

# --- ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(exist_ok=True)
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS users 
                            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                             click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
                             last_collect INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1)''')
            conn.commit()
        logger.info("✅ База данных подключена")
    except Exception as e:
        logger.error(f"❌ Ошибка БД: {e}")

    # Запуск бота
    bot_task = asyncio.create_task(dp.start_polling(bot))
    logger.info("🚀 Бот Neural Pulse запущен")
    yield
    bot_task.cancel()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API МЕТОДЫ ---

@app.get("/api/balance/{user_id}")
@api_error_handler
async def get_balance(user_id: str):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        
        if not row:
            conn.execute("INSERT INTO users (id, balance, last_collect) VALUES (?, 1000, ?)", (user_id, now))
            conn.commit()
            return HTTPWrapper.success(data={"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "league_id": 1, "offline_profit": 0})
        
        user_data = dict(row)
        # Оффлайн доход: 1 монета в сек за уровень бота
        off_time = now - user_data['last_collect']
        profit = 0
        if user_data['bot_lvl'] > 0 and off_time > 60:
            profit = min(off_time * user_data['bot_lvl'], 50000)
        
        user_data['offline_profit'] = profit
        return HTTPWrapper.success(data=user_data)

@app.post("/api/save")
@api_error_handler
async def save_progress(data: SaveData):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("""
            INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect, league_id) 
            VALUES (?, ?, ?, ?, ?, ?) 
            ON CONFLICT(id) DO UPDATE SET 
            balance=excluded.balance, click_lvl=excluded.click_lvl, 
            bot_lvl=excluded.bot_lvl, last_collect=?, league_id=excluded.league_id
        """, (str(data.user_id), data.score, data.click_lvl, data.bot_lvl, now, data.league_id, now))
        conn.commit()
    return HTTPWrapper.success()

# --- ОБРАБОТКА СТАТИКИ ---

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(
            content=index_path.read_text(encoding="utf-8"),
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return HTMLResponse("<h1>Error: static/index.html not found</h1>", status_code=404)

# --- ТЕЛЕГРАМ БОТ ---
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

@dp.message(F.text.startswith("/start"))
async def start_handler(m: types.Message):
    # Уникальный параметр ?v= для обхода кэша
    web_app_url = f"https://{MY_DOMAIN}/?v={int(time.time())}"
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=web_app_url))
    ]])
    await m.answer(f"Привет, <b>{m.from_user.first_name}</b>! 🚀\nТвоя нейронная сеть готова к работе.", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
