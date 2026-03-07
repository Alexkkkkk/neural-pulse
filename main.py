import os, asyncio, logging, time, sys
import aiosqlite, uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, ORJSONResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command, CommandObject
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [КОНФИГУРАЦИЯ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"
WEB_APP_URL = "https://np.bothost.ru" 
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(name)s | %(message)s")
logger = logging.getLogger("NP_ULTRA")

USER_CACHE = {}
LAST_SAVE = {}
db_conn = None
redis_client = None
bot = Bot(token=API_TOKEN)

# --- [СИНХРОНИЗАЦИЯ] ---
async def db_syncer():
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        try:
            to_save = []
            # Безопасное извлечение данных из кэша
            cache_copy = USER_CACHE.copy()
            USER_CACHE.clear() 
            
            now_ts = int(time.time())
            for uid, entry in cache_copy.items():
                d = entry.get("data", {})
                to_save.append((
                    str(uid), float(d.get('score', 0)), int(d.get('tap_power', 1)), 
                    float(d.get('pnl', 0)), float(d.get('energy', 0)), 
                    int(d.get('max_energy', 1000)), int(d.get('level', 1)), now_ts
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
                
                if redis_client:
                    try:
                        pipe = redis_client.pipeline()
                        for user in to_save:
                            pipe.zadd("global_leaderboard", {user[0]: user[1]})
                        await pipe.execute()
                    except Exception: pass
                logger.info(f"💾 Sync OK: {len(to_save)} users.")
        except Exception as e: logger.error(f"Sync Error: {e}")

# --- [LIFECYCLE] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn, redis_client
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=NORMAL")
    await db_conn.execute("""CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
        pnl REAL DEFAULT 0, energy REAL, max_energy INTEGER, 
        level INTEGER DEFAULT 1, last_active INTEGER)""")
    await db_conn.commit()

    if aioredis:
        try:
            redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
            await asyncio.wait_for(redis_client.ping(), timeout=2.0)
            logger.info("🚀 Redis Connected")
        except: redis_client = None

    sync_task = asyncio.create_task(db_syncer())
    dp = Dispatcher()

    @dp.message(Command("start"))
    async def start(m: types.Message, command: CommandObject):
        uid = str(m.from_user.id)
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="ВХОД В НЕЙРОСЕТЬ 🧠", web_app=WebAppInfo(url=f"{WEB_APP_URL}/?u={uid}"))],
            [InlineKeyboardButton(text="СООБЩЕСТВО 👥", url="https://t.me/neural_pulse")]
        ])
        await m.answer(f"🦾 <b>Neural Pulse: Протокол Запущен</b>", reply_markup=kb, parse_mode="HTML")

    polling_task = asyncio.create_task(dp.start_polling(bot))
    yield
    polling_task.cancel()
    sync_task.cancel()
    await db_conn.close()

app = FastAPI(lifespan=lifespan, default_response_class=ORJSONResponse)

# --- [API] ---
@app.get("/api/balance/{user_id}")
async def get_bal(user_id: str):
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id=?", (user_id,)) as cur:
        row = await cur.fetchone()
    
    now = int(time.time())
    if row:
        d = dict(row)
        off_time = min(now - (d['last_active'] or now), 10800)
        earned = (d['pnl'] / 3600) * off_time
        return {"status": "ok", "data": {
            "score": d["balance"] + earned, "tap_power": d["click_lvl"],
            "pnl": d["pnl"], "energy": d["energy"], "level": d["level"],
            "max_energy": d["max_energy"], "multiplier": 1
        }}
    
    await db_conn.execute("INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) VALUES (?,1000,1,0,1000,1000,1,?)", (user_id, now))
    await db_conn.commit()
    return {"status": "ok", "data": {"score": 1000, "tap_power": 1, "pnl": 0, "energy": 1000, "max_energy": 1000, "level": 1, "multiplier": 1}}

@app.post("/api/save")
async def save_state(request: Request):
    try:
        data = await request.json()
        uid = str(data.get("user_id"))
        if not uid or uid == "guest": return {"status": "ignored"}
        now = time.time()
        if now - LAST_SAVE.get(uid, 0) < 0.4: return {"status": "fast"}
        LAST_SAVE[uid] = now
        USER_CACHE[uid] = {"data": data}
        return {"status": "ok"}
    except: return {"status": "error"}

@app.get("/api/leaderboard")
async def get_top():
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 50") as cur:
        rows = await cur.fetchall()
        return {"status": "ok", "top": [{"id": r["id"], "score": r["balance"]} for r in rows]}

# --- [STATIC & FILES HANDLING] ---

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse({"error": "UI not found"}, status_code=404)

# Исправленный хендлер для вложенных файлов (картинки, шрифты)
@app.get("/{file_path:path}")
async def get_static_file(file_path: str):
    # Если путь пустой (корень), FastAPI сам обработает через index
    if not file_path: return
    
    full_path = STATIC_DIR / file_path
    if full_path.exists() and full_path.is_file():
        return FileResponse(full_path)
    return JSONResponse({"status": "not_found"}, status_code=404)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=False)
