import os, asyncio, sqlite3, uvicorn, logging, time, sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКИ ЛОГИРОВАНИЯ ---
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s', 
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NEURAL_PULSE")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "game.db"

TOKEN = "8257287930:AAEjSRHN7MDVNAFNfPxa1CjVSLB0QywQQ3E"
MY_DOMAIN = "np.bothost.ru"

# --- ПРОВЕРКА СТРУКТУРЫ ---
if not STATIC_DIR.exists():
    logger.error(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Папка {STATIC_DIR} не найдена!")
else:
    logger.info(f"✅ Папка статики найдена: {STATIC_DIR}")

# --- МОДЕЛИ ---
class SaveData(BaseModel):
    user_id: int
    score: int
    league_id: int = 1
    click_lvl: int = 1
    bot_lvl: int = 0

# --- ИНИЦИАЛИЗАЦИЯ БД ---
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
        logger.info("✅ База данных готова")
    except Exception as e:
        logger.error(f"❌ Ошибка БД: {e}")

    bot_task = asyncio.create_task(dp.start_polling(bot))
    logger.info("🚀 Приложение запущено на порту 3000")
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
async def get_balance(user_id: str):
    now = int(time.time())
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                conn.execute("INSERT INTO users (id, balance, last_collect) VALUES (?, 1000, ?)", (user_id, now))
                conn.commit()
                return {"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "league_id": 1, "offline_profit": 0}
            return dict(row)
    except Exception as e:
        logger.error(f"🔥 Ошибка API Balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/save")
async def save_progress(data: SaveData):
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("""
                INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect, league_id) 
                VALUES (?, ?, ?, ?, ?, ?) 
                ON CONFLICT(id) DO UPDATE SET 
                balance=excluded.balance, click_lvl=excluded.click_lvl, 
                bot_lvl=excluded.bot_lvl, last_collect=?, league_id=excluded.league_id
            """, (str(data.user_id), data.score, data.click_lvl, data.bot_lvl, int(time.time()), data.league_id, int(time.time())))
            conn.commit()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"🔥 Ошибка API Save: {e}")
        return {"status": "error", "message": str(e)}

# --- ОБРАБОТКА СТАТИКИ ---

# 1. Главная страница с защитой от кэша
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        content = index_path.read_text(encoding="utf-8")
        return HTMLResponse(
            content=content, 
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return HTMLResponse(content="<h1>Error: static/index.html not found</h1>", status_code=404)

# 2. Монтируем подпапку /static для JS, CSS и картинок
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# --- ТЕЛЕГРАМ БОТ ---
bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(F.text.startswith("/start"))
async def start(m: types.Message):
    # Добавляем случайный параметр к URL, чтобы Telegram всегда открывал "свежую" версию
    web_app_url = f"https://{MY_DOMAIN}/?v={int(time.time())}"
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=web_app_url))
    ]])
    await m.answer(f"Привет! Твой нейронный пульс готов к разгону. Нажми кнопку ниже:", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
