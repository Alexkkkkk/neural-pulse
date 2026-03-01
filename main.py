import os, sys, asyncio, sqlite3, uvicorn, logging, time, random, traceback
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

# --- УЛУЧШЕННОЕ ЛОГИРОВАНИЕ ---
# Настройка формата: Время - Имя - Уровень - Сообщение
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

sys.stdout.reconfigure(line_buffering=True)
print("--- [!] ENGINE STARTING ---", flush=True)

# --- НАСТРОЙКИ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "game.db"

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1
    bot_lvl: int = 0

@asynccontextmanager
async def lifespan(app: FastAPI):
    # СОЗДАНИЕ ПАПКИ И ТАБЛИЦ
    DATA_DIR.mkdir(exist_ok=True, parents=True)
    logger.info(f"Connecting to database at {DB_PATH}")
    
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS system_stats 
                            (key TEXT PRIMARY KEY, value INTEGER)''')
            
            conn.execute('''CREATE TABLE IF NOT EXISTS users 
                            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                             click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
                             last_collect INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1)''')
            
            conn.execute("INSERT OR IGNORE INTO system_stats (key, value) VALUES ('jackpot', 500000)")
            conn.commit()
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Database init error: {e}")

    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    logger.info(f"Webhook set to: {webhook_url}")
    
    yield
    await bot.delete_webhook()
    logger.info("Webhook removed.")

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ---
@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        data = await request.json()
        logger.info(f"Incoming Telegram Update")
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Webhook Error: {traceback.format_exc()}")
        return {"ok": False}

@app.get("/api/jackpot")
async def get_jackpot():
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            res = conn.execute("SELECT value FROM system_stats WHERE key='jackpot'").fetchone()
            # Немного увеличиваем джекпот для динамики при каждом запросе
            new_val = (res[0] if res else 500000) + random.randint(1, 10)
            conn.execute("UPDATE system_stats SET value = ? WHERE key='jackpot'", (new_val,))
            conn.commit()
            return {"status": "ok", "data": {"amount": new_val}}
    except Exception as e:
        logger.error(f"Jackpot API error: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    logger.info(f"Loading balance for user: {user_id}")
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not user:
                logger.info(f"New user detected: {user_id}")
                conn.execute("INSERT INTO users (id, balance) VALUES (?, 1000)", (user_id,))
                conn.commit()
                return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "bot_lvl": 0}}
            return {"status": "ok", "data": dict(user)}
    except Exception as e:
        logger.error(f"Balance API error: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/save")
async def save_game(data: SaveData):
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("""
                INSERT INTO users (id, balance, click_lvl, bot_lvl) 
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                balance=excluded.balance, 
                click_lvl=excluded.click_lvl, 
                bot_lvl=excluded.bot_lvl
            """, (str(data.user_id), data.score, data.click_lvl, data.bot_lvl))
            conn.commit()
        # logger.info(f"Saved data for user {data.user_id}: {data.score} NP") # Закомментил, чтобы не спамить в логи каждые 20 сек
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Save Error for user {data.user_id}: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}

@app.get("/", response_class=HTMLResponse)
async def index():
    p = STATIC_DIR / "index.html"
    if p.exists():
        return FileResponse(p)
    logger.error("index.html not found in /static/")
    return HTMLResponse("<h1>index.html not found</h1>", status_code=404)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@dp.message(F.text == "/start")
async def cmd_start(m: types.Message):
    logger.info(f"User {m.from_user.id} started the bot")
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 PLAY NEURAL PULSE", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>System Online, {m.from_user.first_name}!</b>\nWelcome to Neural Pulse.", reply_markup=kb)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
