import os, asyncio, logging, time, sys
import aiosqlite, uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [SETUP] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"
WEB_APP_URL = "https://np.bothost.ru" # Твой URL игры
ADMIN_ID = 476014374 

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
logger = logging.getLogger("NP_PRO")

USER_CACHE = {}
LAST_SAVE = {}
db_conn = None

# --- [DB WORKER - HIGHLOAD] ---
async def db_syncer():
    """Сбрасывает кэш в базу каждые 20 секунд (Highload optimization)"""
    while True:
        await asyncio.sleep(20)
        if not USER_CACHE or not db_conn: continue
        try:
            to_save = []
            keys = list(USER_CACHE.keys())
            for uid in keys:
                entry = USER_CACHE.pop(uid, None)
                if not entry: continue
                d = entry.get("data")
                if not d: continue
                to_save.append((
                    str(uid), 
                    float(d.get('score', 0)), 
                    int(d.get('tap_power', 1)), 
                    float(d.get('energy', 0)), 
                    int(d.get('max_energy', 1000)), 
                    int(time.time())
                ))
            
            if to_save:
                async with db_conn.execute("BEGIN TRANSACTION"):
                    await db_conn.executemany("""
                        INSERT INTO users (id, balance, click_lvl, energy, max_energy, last_active)
                        VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance, energy=excluded.energy, last_active=excluded.last_active
                    """, to_save)
                await db_conn.commit()
                logger.info(f"💾 Синхронизация: {len(to_save)} юзеров")
        except Exception as e: logger.error(f"DB Error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL") 
    await db_conn.execute("""CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
        energy REAL, max_energy INTEGER, last_active INTEGER)""")
    await db_conn.commit()
    
    asyncio.create_task(db_syncer())
    
    # Инициализация бота
    bot = Bot(token=API_TOKEN)
    dp = Dispatcher()
    
    @dp.message(Command("start"))
    async def start(m: types.Message):
        # Генерируем URL с защитой от кэша
        game_url = f"{WEB_APP_URL}/?v={int(time.time())}"
        
        # СОЗДАЕМ КНОПКУ СТАРТА
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="ИГРАТЬ В NEURAL PULSE 🧠", 
                    web_app=WebAppInfo(url=game_url)
                )
            ]
        ])
        
        await m.answer(
            "🧠 <b>Neural Pulse AI</b>\n\nДобро пожаловать в эру нейронного майнинга! "
            "Твоя энергия готова к преобразованию в токены.\n\n"
            "Жми кнопку ниже, чтобы начать:", 
            reply_markup=kb, 
            parse_mode="HTML"
        )

    asyncio.create_task(dp.start_polling(bot))
    yield
    await db_conn.close()

app = FastAPI(lifespan=lifespan)

# --- [API] ---
@app.get("/api/balance/{user_id}")
async def get_bal(user_id: str):
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id=?", (user_id,)) as cur:
        row = await cur.fetchone()
    if row:
        data = dict(row)
        return {"status": "ok", "data": {
            "score": data["balance"],
            "tap_power": data["click_lvl"],
            "energy": data["energy"],
            "max_energy": data["max_energy"]
        }}
    
    # Авто-регистрация нового пользователя
    await db_conn.execute("INSERT INTO users VALUES (?,0,1,1000,1000,?)", (user_id, int(time.time())))
    await db_conn.commit()
    return {"status": "ok", "data": {"score": 0, "tap_power": 1, "energy": 1000, "max_energy": 1000}}

@app.post("/api/save")
async def save(request: Request):
    try:
        data = await request.json()
        uid = str(data.get("user_id"))
        if not uid or uid == "None": return {"status": "error"}
        
        # Anti-Cheat Lite (3 секунды)
        now = time.time()
        if now - LAST_SAVE.get(uid, 0) < 3: 
            return {"status": "too_fast"}
            
        LAST_SAVE[uid] = now
        USER_CACHE[uid] = {"data": data}
        return {"status": "ok"}
    except:
        return {"status": "error"}

@app.get("/")
async def index(): 
    return FileResponse(STATIC_DIR / "index.html")

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
