import os, asyncio, logging, time, sys
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command, CommandObject
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [ЛОГИРОВАНИЕ] ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NeuralPulse")

# --- [КОНФИГУРАЦИЯ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM" 
WEB_APP_URL = "https://np.bothost.ru"

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

class SaveData(BaseModel):
    user_id: str
    score: float = 0.0
    energy: float = 0.0
    max_energy: int = 1000
    pnl: float = 0.0
    level: int = 1
    tap_power: int = 1
    wallet_address: Optional[str] = None
    model_config = ConfigDict(extra='allow')

# --- [БАЗА ДАННЫХ] ---
async def batch_db_update():
    logger.info("🛠️ [DB_WORKER] Фоновый процесс сохранения запущен.")
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        try:
            users_to_update = []
            for uid in list(USER_CACHE.keys()):
                entry = USER_CACHE.get(uid)
                if not entry: continue
                d = entry.get("data")
                if not d: continue
                
                users_to_update.append((
                    str(uid), float(d.get('score', 0)), int(d.get('tap_power', 1)), 
                    float(d.get('energy', 0)), int(d.get('max_energy', 1000)), 
                    float(d.get('pnl', 0)), int(d.get('level', 1)), 
                    d.get('wallet_address'), int(time.time())
                ))
            
            if users_to_update:
                await db_conn.executemany("""
                    INSERT INTO users (id, balance, click_lvl, energy, max_energy, pnl, level, wallet_address, last_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance, click_lvl=excluded.click_lvl,
                        energy=excluded.energy, max_energy=excluded.max_energy,
                        pnl=excluded.pnl, level=excluded.level, 
                        wallet_address=excluded.wallet_address, last_active=excluded.last_active
                """, users_to_update)
                await db_conn.commit()
                logger.info(f"💾 [DB_SYNC] Синхронизация: {len(users_to_update)} юзеров.")
        except Exception as e:
            logger.error(f"❌ [DB_ERROR] Ошибка записи: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    app.state.ready = False 
    try:
        db_conn = await aiosqlite.connect(DB_PATH)
        await db_conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
                energy REAL, max_energy INTEGER, pnl REAL, 
                level INTEGER, wallet_address TEXT, last_active INTEGER
            );
        """)
        await db_conn.commit()
        
        bot = Bot(token=API_TOKEN)
        dp = Dispatcher()
        
        @dp.message(Command("start"))
        async def start_cmd(m: types.Message, command: CommandObject):
            url = f"{WEB_APP_URL}/?v={int(time.time())}"
            if command.args: url += f"&ref={command.args}"
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Играть 🧠", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse AI</b>\nМайни токены своим интеллектом!", reply_markup=kb, parse_mode="HTML")
            
        asyncio.create_task(dp.start_polling(bot))
        asyncio.create_task(batch_db_update())
        app.state.ready = True
        logger.info("🌟 [SERVER] Мозг ИИ активирован.")
    except Exception as e:
        logger.critical(f"💥 Ошибка старта: {e}")
    yield
    if db_conn: await db_conn.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# --- [API] ---

@app.get("/api/health")
async def health():
    return {"status": "ok", "ready": getattr(app.state, "ready", False)}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    if not getattr(app.state, "ready", False): 
        return JSONResponse({"status": "error", "message": "Starting..."}, 503)
    
    uid = str(user_id)
    now = int(time.time())
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        f_data = {
            "score": float(data["balance"]), "tap_power": int(data["click_lvl"]),
            "energy": float(data["energy"]), "max_energy": int(data["max_energy"]),
            "pnl": float(data["pnl"]), "level": int(data["level"]), 
            "wallet_address": data["wallet_address"]
        }
        USER_CACHE[uid] = {"data": f_data, "last_seen": now}
        return {"status": "ok", "data": f_data}
    
    # Новый юзер
    start_bal = 5000.0 if (ref and ref != uid) else 0.0
    new_user = {"score": start_bal, "tap_power": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}
    USER_CACHE[uid] = {"data": new_user, "last_seen": now}
    await db_conn.execute("INSERT INTO users (id, balance, click_lvl, energy, max_energy, pnl, level, last_active) VALUES (?,?,?,?,?,?,?,?)",
        (uid, start_bal, 1, 1000.0, 1000, 0.0, 1, now))
    await db_conn.commit()
    return {"status": "ok", "data": new_user}

@app.post("/api/save")
async def save(data: SaveData):
    USER_CACHE[str(data.user_id)] = {"data": data.model_dump(), "last_seen": time.time()}
    return {"status": "ok"}

# --- [СТАТИКА] ---

@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")

# Монтируем всё остальное (картинки, скрипты) в корень
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
