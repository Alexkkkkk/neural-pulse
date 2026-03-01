import os, asyncio, sqlite3, uvicorn, logging, time, sys, traceback, random
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
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
JACKPOT_CHANCE = 0.0001  
JACKPOT_INCREMENT = 10   

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
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
             click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
             last_collect INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1)''')
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bal ON users(balance DESC)")
        conn.execute("CREATE TABLE IF NOT EXISTS system_stats (key TEXT PRIMARY KEY, value INTEGER)")
        conn.execute("INSERT OR IGNORE INTO system_stats (key, value) VALUES ('jackpot', 0)")
        conn.commit()
    
    await bot.set_webhook(url=WEBHOOK_URL, drop_pending_updates=True)
    logger.info(f"🚀 Webhook active: {WEBHOOK_URL}")
    yield
    await bot.delete_webhook()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- МАРШРУТЫ API (Должны быть ДО монтирования статики) ---

@app.post(WEBHOOK_PATH)
async def bot_webhook(request: Request):
    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

@app.get("/api/jackpot")
@api_error_handler
async def get_jackpot():
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT value FROM system_stats WHERE key = 'jackpot'").fetchone()
        return HTTPWrapper.success({"amount": row["value"] if row else 0})

@app.post("/api/jackpot/try")
@api_error_handler
async def try_jackpot(data: SaveData):
    win, amount = False, 0
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE system_stats SET value = value + ? WHERE key = 'jackpot'", (JACKPOT_INCREMENT,))
        if random.random() < JACKPOT_CHANCE:
            row = conn.execute("SELECT value FROM system_stats WHERE key = 'jackpot'").fetchone()
            amount = row["value"]
            conn.execute("UPDATE system_stats SET value = 0 WHERE key = 'jackpot'")
            conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (amount, str(data.user_id)))
            win = True
        conn.commit()
    return HTTPWrapper.success({"win": win, "amount": amount})

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
            return HTTPWrapper.success({"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "league_id": 1, "offline_profit": 0})
        user = dict(row)
        off_time = min(now - user['last_collect'], 28800)
        profit = (off_time * user['bot_lvl'] * 2) if user['bot_lvl'] > 0 and off_time > 60 else 0
        if profit > 0:
            user['balance'] += profit
            conn.execute("UPDATE users SET balance = ?, last_collect = ? WHERE id = ?", (user['balance'], now, user_id))
            conn.commit()
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

@app.get("/api/leaderboard")
@api_error_handler
async def get_leaderboard(user_id: str = None):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        top_rows = conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10").fetchall()
        top10 = [{"user_id": row["id"], "score": row["balance"]} for row in top_rows]
        user_rank = 0
        if user_id:
            query = """SELECT (SELECT COUNT(*) FROM users WHERE balance > u.balance) + 1 as rank 
                       FROM users u WHERE id = ?"""
            row = conn.execute(query, (user_id,)).fetchone()
            if row: user_rank = row["rank"]
        return HTTPWrapper.success({"top10": top10, "user_rank": user_rank})

# --- СТАТИКА ---

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return "<h1>index.html не найден в папке static!</h1>"

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# --- БОТ ---

@dp.message(F.text == "/start")
async def start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Play Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>System Online, {m.from_user.first_name}!</b>", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
