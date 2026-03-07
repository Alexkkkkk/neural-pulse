import os, asyncio, logging, time, sys, uuid, json
import aiosqlite, uvicorn, aioredis
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, List
from fastapi import FastAPI, Request, BackgroundTasks
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
ADMIN_ID = 476014374 # Твой ID для спец-команд

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
logger = logging.getLogger("NP_ULTRA_CORE")

# Кэш и Глобальные переменные
USER_CACHE = {}
LAST_SAVE = {}
db_conn = None
redis = None
bot = Bot(token=API_TOKEN)

# --- [ФОНОВЫЕ ЗАДАЧИ] ---

async def db_syncer():
    """Синхронизация кэша в БД и обновление рейтинга"""
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
                # Обновляем лидерборд в Redis
                pipe = redis.pipeline()
                for user in to_save:
                    pipe.zadd("global_leaderboard", {user[0]: user[1]})
                await pipe.execute()
                logger.info(f"💾 Sync OK: {len(to_save)} users updated.")
        except Exception as e: logger.error(f"Sync Error: {e}")

# --- [LIFECYCLE] ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn, redis
    redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("""CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
        pnl REAL DEFAULT 0, energy REAL, max_energy INTEGER, 
        level INTEGER DEFAULT 1, last_active INTEGER)""")
    await db_conn.commit()
    
    asyncio.create_task(db_syncer())
    
    dp = Dispatcher()
    
    @dp.message(Command("start"))
    async def start(m: types.Message, command: CommandObject):
        uid = str(m.from_user.id)
        ref_id = command.args
        
        # Реферальная система с защитой от самореферальства
        if ref_id and ref_id != uid:
            await redis.setnx(f"ref:{uid}", ref_id) # Запоминаем кто пригласил
            # Начисление будет произведено при первом сейве или сразу:
            async with db_conn.execute("UPDATE users SET balance = balance + 50000 WHERE id=?", (ref_id,)):
                await db_conn.commit()

        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="ВХОД В НЕЙРОСЕТЬ 🧠", web_app=WebAppInfo(url=f"{WEB_APP_URL}/?u={uid}"))],
            [InlineKeyboardButton(text="СООБЩЕСТВО 👥", url="https://t.me/neural_pulse")]
        ])
        await m.answer(f"🦾 <b>Neural Pulse: Протокол Запущен</b>\n\nДобро пожаловать, Оператор {uid}.\nТвоя задача — ковать будущее ИИ.", reply_markup=kb, parse_mode="HTML")

    # Админ-команда для запуска Шторма
    @dp.message(Command("storm"))
    async def storm_cmd(m: types.Message):
        if m.from_user.id == ADMIN_ID:
            await redis.setex("event:storm", 3600, "active")
            await m.answer("⚡️ <b>НЕЙРО-ШТОРМ АКТИВИРОВАН!</b> (x2 на 1 час)", parse_mode="HTML")

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
    
    now = int(time.time())
    multiplier = 2 if await redis.get("event:storm") else 1

    if row:
        d = dict(row)
        off_time = min(now - d['last_active'], 10800)
        earned = (d['pnl'] / 3600) * off_time
        return {"status": "ok", "data": {
            "score": d["balance"] + earned, "tap_power": d["click_lvl"],
            "pnl": d["pnl"], "energy": d["energy"], "level": d["level"],
            "multiplier": multiplier
        }}
    
    # Регистрация нового юзера
    await db_conn.execute("INSERT INTO users VALUES (?,10000,1,0,1000,1000,1,?)", (user_id, now))
    await db_conn.commit()
    return {"status": "ok", "data": {"score": 10000, "tap_power": 1, "pnl": 0, "energy": 1000, "level": 1, "multiplier": multiplier}}

@app.get("/api/leaderboard")
async def get_top():
    top = await redis.zrevrange("global_leaderboard", 0, 49, withscores=True)
    return {"status": "ok", "leaderboard": [{"id": u, "score": s} for u, s in top]}

@app.post("/api/save")
async def save_state(request: Request):
    try:
        data = await request.json()
        uid = str(data.get("user_id"))
        
        # Anti-Cheat: простая проверка на лету
        if float(data.get('score', 0)) > 10**15: return {"status": "ban_risk"}
        
        now = time.time()
        if now - LAST_SAVE.get(uid, 0) < 1.0: return {"status": "fast"}
        
        LAST_SAVE[uid] = now
        USER_CACHE[uid] = {"data": data}
        return {"status": "ok"}
    except: return {"status": "error"}

# Эндпоинт для проверки статуса ивентов фронтендом
@app.get("/api/events")
async def check_events():
    storm = await redis.ttl("event:storm")
    return {"storm_active": storm > 0, "time_left": max(0, storm)}

# Монтирование фронтенда
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
@app.get("/")
async def index(): return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=False)
