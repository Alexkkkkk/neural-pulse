import os, asyncio, logging, time, sys
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict

# --- [ЛОГИРОВАНИЕ] ---
# Настроено так, чтобы Bothost подхватывал сообщения мгновенно
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

# --- [МОДЕЛИ ДАННЫХ] ---
class SaveData(BaseModel):
    user_id: str
    score: float
    energy: float
    max_energy: int
    pnl: float
    level: int
    tap_power: int
    wallet_address: Optional[str] = None
    model_config = ConfigDict(extra='allow')

class ClientLog(BaseModel):
    user_id: str
    error: str

# --- [БАЗА ДАННЫХ И СИНХРОНИЗАЦИЯ] ---
async def batch_db_update():
    """Фоновое сохранение кэша в БД каждые 15 секунд"""
    logger.info("🛠️ [DB_WORKER] Фоновый процесс сохранения запущен.")
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn:
            continue
            
        try:
            users_to_update = []
            current_cache = list(USER_CACHE.items())
            
            for uid, entry in current_cache:
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
                logger.info(f"💾 [DB_SYNC] Обновлено: {len(users_to_update)} юзеров.")
            
            # Очистка старых сессий (2 часа)
            limit = time.time() - 7200
            inactive = [uid for uid, entry in current_cache if entry.get("last_seen", 0) < limit]
            for uid in inactive:
                del USER_CACHE[uid]
        except Exception as e:
            logger.error(f"❌ [DB_ERROR] Ошибка записи: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    app.state.ready = False 
    try:
        db_conn = await aiosqlite.connect(DB_PATH)
        await db_conn.execute("PRAGMA journal_mode=WAL")
        await db_conn.execute("PRAGMA synchronous=NORMAL")
        await db_conn.execute("PRAGMA cache_size=-64000")
        
        await db_conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
                energy REAL, max_energy INTEGER, pnl REAL, 
                level INTEGER, wallet_address TEXT, last_active INTEGER
            );
        """)
        await db_conn.commit()
        
        from aiogram import Bot, Dispatcher, types
        from aiogram.filters import Command, CommandObject
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
        
        bot = Bot(token=API_TOKEN)
        dp = Dispatcher()
        
        @dp.message(Command("start"))
        async def start_cmd(m: types.Message, command: CommandObject):
            ref_id = command.args if command.args else ""
            url = f"{WEB_APP_URL}/?ref={ref_id}" if ref_id else WEB_APP_URL
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Играть 🧠", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse Online</b>\nТвой мозг — твой капитал.", reply_markup=kb, parse_mode="HTML")
            
        asyncio.create_task(dp.start_polling(bot))
        asyncio.create_task(batch_db_update())
        app.state.ready = True
        logger.info("🌟 [SERVER] Запущен и готов.")
    except Exception as e:
        logger.critical(f"💥 Ошибка старта: {e}")
    yield
    if db_conn: await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API] ---

@app.post("/api/log")
async def log_from_client(data: ClientLog):
    """Принимает ошибки с фронтенда и пишет их в логи Bothost"""
    logger.error(f"📱 [CLIENT_LOG] User {data.user_id}: {data.error}")
    return {"status": "ok"}

@app.get("/api/health")
async def health():
    return {"status": "ok"} if getattr(app.state, "ready", False) else JSONResponse({"status":"off"}, 503)

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    if not getattr(app.state, "ready", False): return JSONResponse({"status": "error"}, 503)
    uid = str(user_id)
    now = int(time.time())

    if uid in USER_CACHE:
        USER_CACHE[uid]["last_seen"] = now
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        f_data = {
            "score": data["balance"], "tap_power": data["click_lvl"],
            "energy": data["energy"], "max_energy": data["max_energy"],
            "pnl": data["pnl"], "level": data["level"], "wallet_address": data["wallet_address"]
        }
        if data.get('last_active'):
            passed = now - data['last_active']
            if passed > 5 and f_data['pnl'] > 0:
                f_data['score'] += (f_data['pnl'] / 3600) * passed
                
        USER_CACHE[uid] = {"data": f_data, "last_seen": now}
        return {"status": "ok", "data": f_data}
    
    # Новый юзер
    start_bal = 5000.0 if ref and ref != "None" and ref != uid else 0.0
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

@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, log_config=None)
