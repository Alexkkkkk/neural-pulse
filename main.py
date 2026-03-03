import os, asyncio, logging, time, datetime, sys
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# --- [ИМПОРТЫ ДЛЯ TG] ---
from aiogram import Bot, Dispatcher, types
from aiogram.types import Update

# --- [КОНФИГ И ЦВЕТА] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = BASE_DIR / "images"
BACKUP_DIR = BASE_DIR / "backups"

API_TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU" 
WEBHOOK_URL = "https://np.bothost.ru/webhook"

C = {"G": "\033[92m", "Y": "\033[93m", "R": "\033[91m", "C": "\033[96m", "B": "\033[1m", "E": "\033[0m"}

def log_step(cat: str, msg: str, col: str = C["G"]):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C['B']}[{curr_time}]{C['E']} {col}{cat.ljust(10)}{C['E']} | {msg}", flush=True)

bot = Bot(token=API_TOKEN)
dp = Dispatcher()

# --- [STAGE 1] ПОДГОТОВКА ФС ---
for folder in [STATIC_DIR, IMAGES_DIR, BACKUP_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

class SaveData(BaseModel):
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int
    exp: int

# --- [STAGE 2] TG ХЭНДЛЕРЫ ---
@dp.message()
async def handle_message(message: types.Message):
    user = message.from_user
    if message.text == "/start":
        kb = types.InlineKeyboardMarkup(inline_keyboard=[
            [types.InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=types.WebAppInfo(url="https://np.bothost.ru/"))]
        ])
        await message.answer(f"Привет, {user.first_name}! Твоя нейросеть готова к майнингу.", reply_markup=kb)

# --- [STAGE 3] ОБСЛУЖИВАНИЕ ---
async def create_backup():
    try:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
        backup_file = BACKUP_DIR / f"game_backup_{timestamp}.db"
        async with aiosqlite.connect(DB_PATH) as src:
            async with aiosqlite.connect(backup_file) as dst:
                await src.backup(dst)
        log_step("BACKUP", f"Создана копия: {backup_file.name}", C["G"])
    except Exception as e:
        log_step("BK_ERR", f"Ошибка бэкапа: {e}", C["R"])

async def maintenance_loop():
    log_step("SYSTEM", "Цикл обслуживания запущен", C["C"])
    while True:
        try:
            await asyncio.sleep(60)
            if USER_CACHE and db_conn:
                current_cache = list(USER_CACHE.items())
                for uid, info in current_cache:
                    d = info.get("data")
                    if not d: continue
                    
                    # Маппинг score/balance для безопасности
                    score_val = d.get('score', d.get('balance', 0))
                    
                    await db_conn.execute(
                        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, last_active=? WHERE id=?",
                        (score_val, d.get('click_lvl', 1), d.get('energy', 1000), d.get('max_energy', 1000), 
                         d.get('pnl', 0), d.get('level', 1), d.get('exp', 0), int(time.time()), uid)
                    )
                await db_conn.commit()
                log_step("DB_SYNC", f"Сохранено игроков: {len(current_cache)}")
                
                if len(USER_CACHE) > 500:
                    USER_CACHE.clear()
        except Exception as e:
            log_step("LOOP_ERR", f"Сбой цикла: {e}", C["R"])

# --- [STAGE 4] LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("DB_START", "Запуск SQLite (WAL mode)...")
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute('''CREATE TABLE IF NOT EXISTS users 
        (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
         energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
         level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)''')
    await db_conn.commit()
    await bot.set_webhook(url=WEBHOOK_URL, drop_pending_updates=True)
    m_task = asyncio.create_task(maintenance_loop())
    yield
    m_task.cancel()
    await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [STAGE 5] API ---
@app.post("/webhook")
async def telegram_webhook(request: Request):
    data = await request.json()
    await dp.feed_update(bot, Update.model_validate(data, context={"bot": bot}))
    return {"status": "ok"}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    if user_id in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[user_id]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        user = await cursor.fetchone()
    
    if not user:
        new_data = {"id": user_id, "score": 1000, "click_lvl": 1, "energy": 1000, "max_energy": 1000, "pnl": 0, "level": 1, "exp": 0}
        await db_conn.execute("INSERT INTO users (id, balance) VALUES (?, ?)", (user_id, 1000))
        await db_conn.commit()
        return {"status": "ok", "data": new_data}
    
    u_dict = dict(user)
    u_dict["score"] = u_dict.pop("balance")
    USER_CACHE[user_id] = {"data": u_dict, "last_save": time.time()}
    return {"status": "ok", "data": u_dict}

@app.post("/api/save")
async def save_game(data: SaveData):
    USER_CACHE[data.user_id] = {"data": data.model_dump(), "last_save": time.time()}
    return {"status": "ok"}

# --- [STAGE 6] СТАТИКА ---
@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html", headers={
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache", "Expires": "0"
    })

app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, proxy_headers=True, forwarded_allow_ips="*")
