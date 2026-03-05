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
from aiogram.filters import CommandObject, Command
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

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

# --- [МОДЕЛИ С ЗАЩИТОЙ ОТ 422] ---
class SaveData(BaseModel):
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int
    exp: Optional[int] = 0 # Добавили как опциональное

    # Это критически важно для предотвращения ошибки 422 при лишних полях из JS
    model_config = ConfigDict(extra='allow')

# --- [ЛОГИКА БАЗЫ ДАННЫХ] ---
async def batch_db_update():
    """ Пакетное сохранение данных из кэша в БД каждые 15 секунд """
    logger.info("Фоновая задача BATCH_SYNC запущена.")
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn:
            continue
        
        try:
            start_time = time.perf_counter()
            users_to_update = []
            
            # Атомарное копирование ключей для избежания ошибок итерации
            current_cache_items = list(USER_CACHE.items())
            
            for uid, entry in current_cache_items:
                d = entry.get("data")
                if not d: continue
                users_to_update.append((
                    str(uid), 
                    float(d.get('score', 0)), 
                    int(d.get('click_lvl', 1)), 
                    float(d.get('energy', 0)), 
                    int(d.get('max_energy', 1000)), 
                    float(d.get('pnl', 0)), 
                    int(d.get('level', 1)), 
                    int(time.time())
                ))

            if users_to_update:
                # Массовая запись: Insert or Update (Upsert)
                await db_conn.executemany("""
                    INSERT INTO users (id, balance, click_lvl, energy, max_energy, pnl, level, last_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance,
                        click_lvl=excluded.click_lvl,
                        energy=excluded.energy,
                        max_energy=excluded.max_energy,
                        pnl=excluded.pnl,
                        level=excluded.level,
                        last_active=excluded.last_active
                """, users_to_update)
                await db_conn.commit()
                
                duration = time.perf_counter() - start_time
                logger.info(f"BATCH_SYNC: {len(users_to_update)} юзеров синхронизировано за {duration:.4f} сек.")
            
        except Exception as e:
            logger.error(f"Ошибка пакетной записи: {e}", exc_info=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    logger.info(f"Инициализация системы. БД: {DB_PATH}")
    
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=NORMAL")
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
            energy REAL, max_energy INTEGER, pnl REAL, 
            level INTEGER, last_active INTEGER
        )
    """)
    await db_conn.commit()
    
    bot = Bot(token=API_TOKEN)
    dp = Dispatcher()
    
    @dp.message(Command("start"))
    async def start(m: types.Message):
        logger.info(f"Команда /start: {m.from_user.id}")
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))
        ]])
        await m.answer("<b>Neural Pulse Online</b>\nДоступ разрешен.", reply_markup=kb, parse_mode="HTML")

    logger.info("Запуск Telegram Bot и фоновых процессов.")
    asyncio.create_task(dp.start_polling(bot))
    asyncio.create_task(batch_db_update())
    
    yield
    if db_conn:
        await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    
    if uid in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance") 
        USER_CACHE[uid] = {"data": data}
        logger.info(f"API: Пользователь {uid} загружен из БД в кэш.")
        return {"status": "ok", "data": data}
    
    # Регистрация нового игрока
    new_data = {"score": 1000.0, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1}
    USER_CACHE[uid] = {"data": new_data}
    logger.info(f"API: Зарегистрирован новый игрок {uid}")
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    # Теперь лишние поля в JSON не вызывают ошибку 422
    USER_CACHE[data.user_id] = {"data": data.model_dump()}
    return {"status": "ok"}

@app.get("/api/jackpot")
async def jackpot():
    return {"status": "ok", "value": 777000}

# Монтирование статики и изображений (дизайн сохраняется)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
