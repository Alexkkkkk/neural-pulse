import os, asyncio, logging, time, sys
import aiosqlite, uvicorn
import redis.asyncio as aioredis  # Исправленный импорт
from pathlib import Path
from contextlib import asynccontextmanager
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
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
ADMIN_ID = 476014374 

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
logger = logging.getLogger("NP_ULTRA_CORE")

USER_CACHE = {}
LAST_SAVE = {}
db_conn = None
redis = None
bot = Bot(token=API_TOKEN)

# --- [СИНХРОНИЗАЦИЯ] ---
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
                
                if redis:
                    pipe = redis.pipeline()
                    for user in to_save:
                        pipe.zadd("global_leaderboard", {user[0]: user[1]})
                    await pipe.execute()
                logger.info(f"💾 Sync OK: {len(to_save)} users.")
        except Exception as e: logger.error(f"Sync Error: {e}")

# --- [LIFECYCLE] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn, redis
    # 1. Проверка структуры
    if not STATIC_DIR.exists():
        logger.error(f"CRITICAL: Static directory not found at {STATIC_DIR}")
        STATIC_DIR.mkdir(exist_ok=True)

    # 2. БД и Redis
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("""CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
        pnl REAL DEFAULT 0, energy REAL, max_energy INTEGER, 
        level INTEGER DEFAULT 1, last_active INTEGER)""")
    await db_conn.commit()

    try:
        redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
        await redis.ping()
        logger.info("🚀 Redis Connected")
    except:
        logger.warning("⚠️ Redis not available, leaderboard disabled")
        redis = None

    asyncio.create_task(db_syncer())
    
    dp = Dispatcher()

    @dp.message(Command("start"))
    async def start(m: types.Message, command: CommandObject):
        uid = str(m.from_user.id)
        # Обработка реферала
        if command.args and redis:
            ref_id = command.args
            if ref_id != uid:
                await redis.setnx(f"ref:{uid}", ref_id)

        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="ВХОД В НЕЙРОСЕТЬ 🧠", web_app=WebAppInfo(url=f"{WEB_APP_URL}/?u={uid}"))],
            [InlineKeyboardButton(text="СООБЩЕСТВО 👥", url="https://t.me/neural_pulse")]
        ])
        await m.answer(f"🦾 <b>Neural Pulse: Протокол Запущен</b>\n\nДобро пожаловать в систему.", reply_markup=kb, parse_mode="HTML")

    polling_task = asyncio.create_task(dp.start_polling(bot))
    yield
    polling_task.cancel()
    await db_conn.close()
    if redis: await redis.close()

app = FastAPI(lifespan=lifespan)

# --- [API] ---
@app.get("/api/balance/{user_id}")
async def get_bal(user_id: str):
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id=?", (user_id,)) as cur:
        row = await cur.fetchone()
    
    now = int(time.time())
    storm_active = False
    if redis:
        storm_active = await redis.get("event:storm") is not None
    
    multiplier = 2 if storm_active else 1

    if row:
        d = dict(row)
        # Считаем оффлайн доход (макс 3 часа)
        off_time = min(now - (d['last_active'] or now), 10800)
        earned = (d['pnl'] / 3600) * off_time
        return {"status": "ok", "data": {
            "score": d["balance"] + earned, "tap_power": d["click_lvl"],
            "pnl": d["pnl"], "energy": d["energy"], "level": d["level"],
            "max_energy": d["max_energy"], "multiplier": multiplier
        }}
    
    # Новый юзер
    await db_conn.execute("INSERT INTO users VALUES (?,1000,1,0,1000,1000,1,?)", (user_id, now))
    await db_conn.commit()
    return {"status": "ok", "data": {"score": 1000, "tap_power": 1, "pnl": 0, "energy": 1000, "max_energy": 1000, "level": 1, "multiplier": multiplier}}

@app.post("/api/save")
async def save_state(request: Request):
    try:
        data = await request.json()
        uid = str(data.get("user_id"))
        if not uid or uid == "guest": return {"status": "ignored"}
        
        now = time.time()
        if now - LAST_SAVE.get(uid, 0) < 1.0: return {"status": "fast"}
        
        LAST_SAVE[uid] = now
        USER_CACHE[uid] = {"data": data}
        return {"status": "ok"}
    except: return {"status": "error"}

@app.get("/api/leaderboard")
async def get_top():
    if not redis: return {"status": "error", "top": []}
    top = await redis.zrevrange("global_leaderboard", 0, 49, withscores=True)
    return {"status": "ok", "top": [{"id": u, "score": s} for u, s in top]}

# --- [STATIC] ---
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse({"error": "index.html not found in static/"}, status_code=404)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=False)
