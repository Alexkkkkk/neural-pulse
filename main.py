import os, sys, asyncio, sqlite3, uvicorn, logging, random, traceback
from datetime import date, timedelta
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

# --- НАСТРОЙКА ЛОГИРОВАНИЯ ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Принудительный сброс буфера для логов хостинга
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

# --- КОНФИГУРАЦИЯ ---
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

# --- ЖИЗНЕННЫЙ ЦИКЛ (БАЗА ДАННЫХ) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создаем папки
    DATA_DIR.mkdir(exist_ok=True, parents=True)
    STATIC_DIR.mkdir(exist_ok=True, parents=True)
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        # 1. Таблица пользователей
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, click_lvl INTEGER DEFAULT 1, 
             bot_lvl INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1,
             last_bonus_date TEXT DEFAULT '', streak_days INTEGER DEFAULT 0)''')
        
        # 2. Системные статы (Джекпот)
        conn.execute("CREATE TABLE IF NOT EXISTS system_stats (key TEXT PRIMARY KEY, value INTEGER)")
        conn.execute("INSERT OR IGNORE INTO system_stats VALUES ('jackpot', 500000)")
        
        # 3. История победителей
        conn.execute('''CREATE TABLE IF NOT EXISTS winners 
            (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, amount INTEGER, ts DATETIME DEFAULT CURRENT_TIMESTAMP)''')
        conn.commit()
    
    logger.info("Database initialized.")
    await bot.set_webhook(url=f"https://{MY_DOMAIN}/webhook", drop_pending_updates=True)
    yield
    logger.info("Shutting down...")

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ЭНДПОИНТЫ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.execute("INSERT INTO users (id, balance) VALUES (?, 1000)", (user_id,))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "streak_days": 0}}
        return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    LIMIT = 1000000
    START_JACKPOT = 500000
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            
            # 1. Налог на джекпот (1% от прибыли)
            old = conn.execute("SELECT balance FROM users WHERE id = ?", (str(data.user_id),)).fetchone()
            profit = data.score - (old["balance"] if old else 0)
            if profit > 0:
                tax = max(1, int(profit * 0.01))
                conn.execute("UPDATE system_stats SET value = value + ? WHERE key='jackpot'", (tax,))
            
            # 2. Проверка взрыва джекпота
            jack_res = conn.execute("SELECT value FROM system_stats WHERE key='jackpot'").fetchone()
            jack_val = jack_res[0] if jack_res else START_JACKPOT
            
            winner_id = None
            if jack_val >= LIMIT:
                win_row = conn.execute("SELECT id FROM users ORDER BY RANDOM() LIMIT 1").fetchone()
                if win_row:
                    winner_id = win_row["id"]
                    conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (jack_val, winner_id))
                    conn.execute("INSERT INTO winners (user_id, amount) VALUES (?, ?)", (winner_id, jack_val))
                    conn.execute("UPDATE system_stats SET value = ?", (START_JACKPOT,))
                    jack_val = START_JACKPOT
                    logger.info(f"!!! JACKPOT EXPLOSION !!! Winner: {winner_id}")

            # 3. Сохранение данных игрока
            conn.execute("""INSERT INTO users (id, balance, click_lvl, bot_lvl) VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET balance=excluded.balance, click_lvl=excluded.click_lvl, bot_lvl=excluded.bot_lvl""",
                (str(data.user_id), data.score, data.click_lvl, data.bot_lvl))
            conn.commit()
            
            return {"status": "ok", "jackpot": jack_val, "explosion": winner_id is not None, "winner": winner_id}
    except Exception as e:
        logger.error(f"Save error: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/upgrade")
async def upgrade(data: dict):
    uid = str(data.get("user_id"))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT balance, click_lvl FROM users WHERE id = ?", (uid,)).fetchone()
        if not user: return {"status": "error", "message": "User not found"}
        
        cost = user["click_lvl"] * 500
        if user["balance"] >= cost:
            new_lvl = user["click_lvl"] + 1
            new_bal = user["balance"] - cost
            conn.execute("UPDATE users SET balance=?, click_lvl=? WHERE id=?", (new_bal, new_lvl, uid))
            conn.commit()
            return {"status": "ok", "new_balance": new_bal, "new_lvl": new_lvl, "next_cost": new_lvl * 500}
    return {"status": "error", "message": "Low balance"}

@app.post("/api/daily-bonus")
async def daily_bonus(data: dict):
    uid = str(data.get("user_id"))
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    rewards = [1000, 2500, 5000, 10000, 25000, 50000, 100000]
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        u = conn.execute("SELECT balance, last_bonus_date, streak_days FROM users WHERE id=?", (uid,)).fetchone()
        if not u: return {"status": "error", "message": "User not found"}
        if u["last_bonus_date"] == today: return {"status": "error", "message": "Уже получено"}
        
        new_streak = (u["streak_days"] + 1) if u["last_bonus_date"] == yesterday else 1
        if new_streak > 7: new_streak = 1 # Сброс после недели
        
        reward = rewards[new_streak-1]
        conn.execute("UPDATE users SET balance=balance+?, last_bonus_date=?, streak_days=? WHERE id=?", 
                     (reward, today, new_streak, uid))
        conn.commit()
        return {"status": "ok", "reward": reward, "streak": new_streak}

@app.get("/api/winners")
async def get_winners():
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        res = conn.execute("SELECT user_id, amount FROM winners ORDER BY id DESC LIMIT 5").fetchall()
        return {"status": "ok", "data": [dict(r) for r in res]}

# --- СТАТИКА И БОТ ---
@app.get("/", response_class=HTMLResponse)
async def index():
    p = STATIC_DIR / "index.html"
    if p.exists(): return FileResponse(p)
    return HTMLResponse("<h1>404: Frontend not found</h1>", status_code=404)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception:
        return {"ok": False}

@dp.message(F.text == "/start")
async def cmd_start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 PLAY NEURAL PULSE", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>System Online, {m.from_user.first_name}!</b>\nНажимай на кнопку, чтобы войти в Neural Pulse.", reply_markup=kb)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
