import os, sys, asyncio, sqlite3, uvicorn, logging, time, random, traceback
from pathlib import Path
from contextlib import asynccontextmanager
from functools import wraps
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

# --- ФОРСИРОВАННЫЙ ВЫВОД ЛОГОВ ---
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)
print("--- [!] ENGINE STARTING ---", flush=True)

# --- НАСТРОЙКИ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "game.db"

# --- ИНИЦИАЛИЗАЦИЯ ---
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int
    league_id: int = 1
    click_lvl: int = 1
    bot_lvl: int = 0

@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(exist_ok=True, parents=True)
    print(f"--- [DB] CONNECTING TO {DB_PATH} ---", flush=True)
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
             click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
             last_collect INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1)''')
        conn.execute("INSERT OR IGNORE INTO system_stats (key, value) VALUES ('jackpot', 0)")
        conn.commit()
    
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    print(f"--- [!] WEBHOOK READY: {webhook_url} ---", flush=True)
    yield
    await bot.delete_webhook()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ЭНДПОИНТЫ ---

@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception:
        return {"ok": False}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.execute("INSERT INTO users (id, balance) VALUES (?, 1000)", (user_id,))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "bot_lvl": 0}}
        return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("""INSERT INTO users (id, balance, click_lvl, bot_lvl) 
            VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET 
            balance=excluded.balance, click_lvl=excluded.click_lvl, bot_lvl=excluded.bot_lvl""", 
            (str(data.user_id), data.score, data.click_lvl, data.bot_lvl))
        conn.commit()
    return {"status": "ok"}

@app.get("/", response_class=HTMLResponse)
async def index():
    p = STATIC_DIR / "index.html"
    if p.exists():
        return FileResponse(p)
    return "<h1>Frontend (index.html) not found in /static/</h1>"

# --- МОНТИРОВАНИЕ СТАТИКИ ---
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# --- ЛОГИКА БОТА ---
@dp.message(F.text == "/start")
async def cmd_start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 PLAY NEURAL PULSE", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>System Online, {m.from_user.first_name}!</b>", reply_markup=kb)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    print(f"--- [!] RUNNING ON PORT {port} ---", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)
