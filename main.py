import os, asyncio, logging, time, datetime, sys
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
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [НАСТРОЙКА ЛОГИРОВАНИЯ] ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NeuralPulse")

# --- [КОНФИГУРАЦИЯ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"

# Кэш: храним только активных юзеров, чтобы не переполнять RAM
USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

# --- [МОДЕЛИ] ---
class SaveData(BaseModel):
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int
    exp: Optional[int] = 0
    model_config = ConfigDict(extra='allow')

# --- [СИСТЕМА ОЧИСТКИ КЭША] ---
async def cache_garbage_collector():
    """Удаляет из памяти юзеров, которые не заходили более 10 минут"""
    while True:
        await asyncio.sleep(300)
        now = time.time()
        to_remove = [uid for uid, entry in USER_CACHE.items() 
                     if now - entry.get("last_seen", 0) > 600]
        for uid in to_remove:
            del USER_CACHE[uid]
        if to_remove:
            logger.info(f"GC: Очищено {len(to_remove)} неактивных сессий из RAM.")

# --- [ЛОГИКА БАЗЫ ДАННЫХ] ---
async def batch_db_update():
    """ Пакетное сохранение данных каждые 15 секунд """
    logger.info("Фоновая задача BATCH_SYNC активна.")
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        
        try:
            start_time = time.perf_counter()
            users_to_update = []
            
            # Копируем данные для записи
            for uid, entry in list(USER_CACHE.items()):
                d = entry.get("data")
                if not d: continue
                users_to_update.append((
                    str(uid), float(d.get('score', 0)), int(d.get('click_lvl', 1)), 
                    float(d.get('energy', 0)), int(d.get('max_energy', 1000)), 
                    float(d.get('pnl', 0)), int(d.get('level', 1)), int(time.time())
                ))

            if users_to_update:
                await db_conn.executemany("""
                    INSERT INTO users (id, balance, click_lvl, energy, max_energy, pnl, level, last_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance, click_lvl=excluded.click_lvl,
                        energy=excluded.energy, max_energy=excluded.max_energy,
                        pnl=excluded.pnl, level=excluded.level, last_active=excluded.last_active
                """, users_to_update)
                await db_conn.commit()
                logger.info(f"BATCH_SYNC: Записано {len(users_to_update)} юзеров за {time.perf_counter()-start_time:.4f}с.")
        except Exception as e:
            logger.error(f"Ошибка синхронизации: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    # Оптимизация SQLite под 20 млн записей
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=NORMAL")
    await db_conn.execute("PRAGMA cache_size=-128000") # 128MB кэша БД
    
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
            energy REAL, max_energy INTEGER, pnl REAL, 
            level INTEGER, last_active INTEGER
        )
    """)
    # ИНДЕКС — спасение при миллионах юзеров
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_user_id ON users(id)")
    await db_conn.commit()
    
    bot = Bot(token=API_TOKEN)
    dp = Dispatcher()
    
    @dp.message(Command("start"))
    async def start(m: types.Message):
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))
        ]])
        await m.answer("<b>Neural Pulse Online</b>\nВход в систему выполнен.", reply_markup=kb, parse_mode="HTML")

    asyncio.create_task(dp.start_polling(bot))
    asyncio.create_task(batch_db_update())
    asyncio.create_task(cache_garbage_collector())
    
    yield
    await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    if uid in USER_CACHE:
        USER_CACHE[uid]["last_seen"] = time.time()
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance") 
        USER_CACHE[uid] = {"data": data, "last_seen": time.time()}
        return {"status": "ok", "data": data}
    
    new_data = {"score": 0.0, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1}
    USER_CACHE[uid] = {"data": new_data, "last_seen": time.time()}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    uid = data.user_id
    # Простой Анти-чит: ограничение на резкий скачок баланса
    if uid in USER_CACHE:
        current_score = USER_CACHE[uid]["data"].get("score", 0)
        if (data.score - current_score) > 5000: # Максимум 5к за 10 сек (защита от кликеров)
            logger.warning(f"Anti-Cheat: Подозрительный скачок у {uid}")
            return {"status": "error", "message": "Too fast"}

    USER_CACHE[uid] = {"data": data.model_dump(), "last_seen": time.time()}
    return {"status": "ok"}

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
