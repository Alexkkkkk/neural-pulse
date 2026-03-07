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
ADMIN_ID = 476014374 

USER_CACHE: Dict[str, dict] = {}
LAST_SAVE_TIME: Dict[str, float] = {}
db_conn: Optional[aiosqlite.Connection] = None
bot_instance: Optional[Bot] = None

# Сделали модель максимально гибкой, чтобы избежать 422 ошибки
class SaveData(BaseModel):
    user_id: str
    score: Optional[float] = 0.0
    energy: Optional[float] = 0.0
    model_config = ConfigDict(extra='allow')

# --- [БАЗА ДАННЫХ] ---
async def batch_db_update():
    logger.info("🛠️ [DB_WORKER] Фоновый процесс сохранения активен.")
    while True:
        await asyncio.sleep(20) # Увеличили интервал до 20 сек для стабильности
        if not USER_CACHE or not db_conn: continue
        try:
            users_to_update = []
            keys = list(USER_CACHE.keys())
            for uid in keys:
                entry = USER_CACHE.pop(uid, None)
                if not entry: continue
                d = entry.get("data")
                # Извлекаем данные безопасно, даже если фронтенд прислал мусор
                users_to_update.append((
                    str(uid), float(d.get('score', 0)), int(d.get('tap_power', d.get('click_lvl', 1))), 
                    float(d.get('energy', 0)), int(d.get('max_energy', 1000)), 
                    float(d.get('pnl', 0)), int(d.get('level', 1)), 
                    d.get('wallet_address'), int(time.time())
                ))
            if users_to_update:
                async with db_conn.execute("BEGIN TRANSACTION"):
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
                logger.info(f"💾 [DB_SYNC] Записано в базу: {len(users_to_update)} юзеров.")
        except Exception as e:
            logger.error(f"❌ [DB_ERROR] {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn, bot_instance
    app.state.ready = False 
    try:
        db_conn = await aiosqlite.connect(DB_PATH)
        await db_conn.execute("PRAGMA journal_mode=WAL")
        await db_conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
                energy REAL, max_energy INTEGER, pnl REAL, 
                level INTEGER, wallet_address TEXT, last_active INTEGER
            );
        """)
        await db_conn.commit()
        bot_instance = Bot(token=API_TOKEN)
        dp = Dispatcher()
        
        @dp.message(Command("start"))
        async def start_cmd(m: types.Message, command: CommandObject):
            url = f"{WEB_APP_URL}/?v={int(time.time())}"
            if command.args: url += f"&ref={command.args}"
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Играть 🧠", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse AI</b>\nМайни токены своим интеллектом!", reply_markup=kb, parse_mode="HTML")

        @dp.message(Command("stats"))
        async def stats_cmd(m: types.Message):
            if m.from_user.id != ADMIN_ID: return
            async with db_conn.execute("SELECT COUNT(*), SUM(balance) FROM users") as cur:
                row = await cur.fetchone()
                count, total_bal = row
            await m.answer(f"📊 👤 Игроков: {count}\n💰 Всего монет: {total_bal or 0:,.0f}")

        asyncio.create_task(dp.start_polling(bot_instance))
        asyncio.create_task(batch_db_update())
        app.state.ready = True
        logger.info("🌟 [SERVER] Мозг ИИ готов.")
    except Exception as e:
        logger.critical(f"💥 Ошибка старта: {e}")
    yield
    if bot_instance: await bot_instance.session.close()
    if db_conn: await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    if not getattr(app.state, "ready", False) or not db_conn: return JSONResponse({"status": "error"}, 503)
    uid = str(user_id)
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        return {"status": "ok", "data": {
            "score": float(data["balance"]), "tap_power": int(data["click_lvl"]),
            "energy": float(data["energy"]), "max_energy": int(data["max_energy"]),
            "pnl": float(data["pnl"]), "level": int(data["level"]), "wallet_address": data["wallet_address"]
        }}
    
    # Регистрация нового
    start_bal = 5000.0 if (ref and ref != uid) else 0.0
    await db_conn.execute("INSERT INTO users (id, balance, click_lvl, energy, max_energy, pnl, level, last_active) VALUES (?,?,?,?,?,?,?,?)",
                        (uid, start_bal, 1, 1000.0, 1000, 0.0, 1, int(time.time())))
    await db_conn.commit()
    try: await bot_instance.send_message(ADMIN_ID, f"🆕 Новый игрок: {uid}")
    except: pass
    return {"status": "ok", "data": {"score": start_bal, "tap_power": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}}

@app.post("/api/save")
async def save(request: Request):
    try:
        # Принимаем данные в любом виде, чтобы не было ошибки 422
        data = await request.json()
        uid = str(data.get("user_id"))
        if not uid or uid == "None": return {"status": "ignored"}

        now = time.time()
        # Лимит: сохраняем не чаще чем раз в 5 секунд для снижения нагрузки
        if now - LAST_SAVE_TIME.get(uid, 0) < 5.0:
            return {"status": "ok", "message": "throttled"}
            
        LAST_SAVE_TIME[uid] = now
        USER_CACHE[uid] = {"data": data, "last_seen": now}
        return {"status": "ok"}
    except:
        return {"status": "error"}

@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=False)
