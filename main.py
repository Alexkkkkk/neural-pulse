import os, asyncio, logging, time, sys, uuid
import aiosqlite, uvicorn, aioredis
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command, CommandObject
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [SETUP] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"
WEB_APP_URL = "https://np.bothost.ru" 
REDIS_URL = "redis://localhost:6379"

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
logger = logging.getLogger("NP_PRO_ULTRA")

USER_CACHE = {}
LAST_SAVE = {}
db_conn = None
redis = None

# --- [DB WORKER - HIGHLOAD READY] ---
async def db_syncer():
    while True:
        await asyncio.sleep(15)
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
                    str(uid), float(d.get('score', 0)), int(d.get('tap_power', 1)), 
                    float(d.get('pnl', 0)), float(d.get('energy', 0)), 
                    int(d.get('max_energy', 1000)), int(d.get('level', 1)), int(time.time())
                ))
            
            if to_save:
                async with db_conn.execute("BEGIN TRANSACTION"):
                    await db_conn.executemany("""
                        INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active)
                        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance, click_lvl=excluded.click_lvl, pnl=excluded.pnl,
                        energy=excluded.energy, level=excluded.level, last_active=excluded.last_active
                    """, to_save)
                await db_conn.commit()
                # Обновляем лидерборд в Redis после записи в основную БД
                for user in to_save:
                    await redis.zadd("global_leaderboard", {user[0]: user[1]})
                logger.info(f"💾 Highload Sync & Leaderboard Update: {len(to_save)} юзеров")
        except Exception as e: logger.error(f"DB Error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn, redis
    # Подключаем Redis
    redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    # Подключаем SQLite
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("""CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
        pnl REAL DEFAULT 0, energy REAL, max_energy INTEGER, 
        level INTEGER DEFAULT 1, last_active INTEGER)""")
    await db_conn.commit()
    
    asyncio.create_task(db_syncer())
    
    bot = Bot(token=API_TOKEN)
    dp = Dispatcher()
    
    @dp.message(Command("start"))
    async def start(m: types.Message, command: CommandObject):
        uid = str(m.from_user.id)
        ref_id = command.args
        if ref_id and ref_id != uid:
            async with db_conn.execute("UPDATE users SET balance = balance + 25000 WHERE id=?", (ref_id,)) as cur:
                if cur.rowcount > 0:
                    await db_conn.commit()
                    try: await bot.send_message(ref_id, "🎁 +25,000 NP! Твой реферал в игре!")
                    except: pass

        game_url = f"{WEB_APP_URL}/?v={int(time.time())}"
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="ИГРАТЬ В NEURAL PULSE 🧠", web_app=WebAppInfo(url=game_url))]
        ])
        await m.answer(f"🚀 <b>Neural Pulse Pro</b>\nДобывай токены будущего!", reply_markup=kb, parse_mode="HTML")

    asyncio.create_task(dp.start_polling(bot))
    yield
    await db_conn.close()

app = FastAPI(lifespan=lifespan)

# --- [API ENDPOINTS] ---

@app.get("/api/balance/{user_id}")
async def get_bal(user_id: str):
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id=?", (user_id,)) as cur:
        row = await cur.fetchone()
    
    now = int(time.time())
    # Проверка глобального ивента
    event_active = await redis.get("event:storm")
    multiplier = 2 if event_active else 1

    if row:
        data = dict(row)
        off_time = min(now - data['last_active'], 10800)
        earned = (data['pnl'] / 3600) * off_time
        return {"status": "ok", "data": {
            "score": data["balance"] + earned, "tap_power": data["click_lvl"],
            "pnl": data["pnl"], "energy": data["energy"],
            "max_energy": data["max_energy"], "level": data["level"],
            "multiplier": multiplier
        }}
    
    await db_conn.execute("INSERT INTO users VALUES (?,5000,1,0,1000,1000,1,?)", (user_id, now))
    await db_conn.commit()
    return {"status": "ok", "data": {"score": 5000, "tap_power": 1, "pnl": 0, "energy": 1000, "max_energy": 1000, "level": 1, "multiplier": multiplier}}

@app.get("/api/leaderboard")
async def get_leaderboard():
    """Топ-100 игроков из Redis мгновенно"""
    top = await redis.zrevrange("global_leaderboard", 0, 99, withscores=True)
    return {"status": "ok", "top": [{"id": x[0], "score": x[1]} for x in top]}

@app.post("/api/fusion")
async def handle_fusion(request: Request):
    """Логика слияния модулей"""
    data = await request.json()
    # Здесь можно добавить проверку ресурсов и создание артефакта
    # Для простоты возвращаем успех
    return {"status": "ok", "artifact_id": str(uuid.uuid4())[:8]}

@app.post("/api/save")
async def save(request: Request):
    try:
        data = await request.json()
        uid = str(data.get("user_id"))
        if not uid or uid == "None": return {"status": "error"}
        now = time.time()
        if now - LAST_SAVE.get(uid, 0) < 2: return {"status": "throttled"}
        LAST_SAVE[uid] = now
        USER_CACHE[uid] = {"data": data}
        return {"status": "ok"}
    except: return {"status": "error"}

@app.get("/")
async def index(): return FileResponse(STATIC_DIR / "index.html")
app.mount("/", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=False)
