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

# Попробуем импортировать aiogram, если его нет - бот просто не запустится
try:
    from aiogram import Bot, Dispatcher, types
    from aiogram.filters import Command, CommandObject
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    AIOGRAM_AVAILABLE = True
except ImportError:
    AIOGRAM_AVAILABLE = False

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
# Твой актуальный токен
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"
WEB_APP_URL = "https://np.bothost.ru/"
ADMIN_WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

# --- [МОДЕЛИ] ---
class SaveData(BaseModel):
    user_id: str
    score: float
    energy: float
    max_energy: int
    pnl: float
    level: int
    # Поля сделаны необязательными, чтобы избежать ошибки 422
    click_lvl: Optional[int] = 1
    wallet_address: Optional[str] = None  
    referrer_id: Optional[str] = None
    model_config = ConfigDict(extra='allow')

# --- [ФОНОВЫЕ ЗАДАЧИ] ---
async def cache_garbage_collector():
    while True:
        await asyncio.sleep(300)
        now = time.time()
        to_remove = [uid for uid, entry in USER_CACHE.items() if now - entry.get("last_seen", 0) > 900]
        for uid in to_remove:
            del USER_CACHE[uid]
        if to_remove:
            logger.info(f"GC: Очищено {len(to_remove)} сессий.")

async def batch_db_update():
    logger.info("Фоновая задача BATCH_SYNC активна.")
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        try:
            users_to_update = []
            for uid, entry in list(USER_CACHE.items()):
                d = entry.get("data")
                if not d: continue
                # Мапим score обратно в balance для БД
                users_to_update.append((
                    str(uid), 
                    float(d.get('score', 0)), 
                    int(d.get('click_lvl', 1)), 
                    float(d.get('energy', 0)), 
                    int(d.get('max_energy', 1000)), 
                    float(d.get('pnl', 0)), 
                    int(d.get('level', 1)), 
                    d.get('wallet_address'), 
                    int(time.time())
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
        except Exception as e:
            logger.error(f"Ошибка периодического сохранения: {e}")

# --- [LIFESPAN] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=NORMAL")
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, 
            balance REAL, 
            click_lvl INTEGER, 
            energy REAL, 
            max_energy INTEGER, 
            pnl REAL, 
            level INTEGER, 
            wallet_address TEXT, 
            last_active INTEGER
        )
    """)
    await db_conn.commit()
    
    if AIOGRAM_AVAILABLE:
        bot = Bot(token=API_TOKEN)
        dp = Dispatcher()
        
        @dp.message(Command("start"))
        async def start(m: types.Message, command: CommandObject):
            ref_id = command.args if command.args else ""
            url = f"{WEB_APP_URL}?tgWebAppStartParam={ref_id}" if ref_id else WEB_APP_URL
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Играть в 1 клик ⚡", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(
                f"<b>Neural Pulse Online</b>\n\nПривет, {m.from_user.first_name}!\nТвой мозг — это вычислительный узел. Начинай майнинг и подключай TON кошелек.",
                reply_markup=kb, parse_mode="HTML"
            )
        asyncio.create_task(dp.start_polling(bot))
    
    asyncio.create_task(batch_db_update())
    asyncio.create_task(cache_garbage_collector())
    yield
    if db_conn:
        await db_conn.close()

# --- [APP SETUP] ---
app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    uid = str(user_id)
    
    # 1. Проверяем кэш
    if uid in USER_CACHE:
        USER_CACHE[uid]["last_seen"] = time.time()
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    # 2. Проверяем БД
    if not db_conn:
        return {"status": "error", "message": "Database not ready"}

    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance") # Для фронта balance -> score
        USER_CACHE[uid] = {"data": data, "last_seen": time.time()}
        return {"status": "ok", "data": data}
    
    # 3. Новый пользователь
    # Бонус 5000 если пришел по рефке
    start_balance = 5000.0 if ref and ref != uid else 0.0
    new_data = {
        "score": start_balance, 
        "click_lvl": 1, 
        "energy": 1000.0, 
        "max_energy": 1000, 
        "pnl": 0.0, 
        "level": 1, 
        "wallet_address": None
    }
    USER_CACHE[uid] = {"data": new_data, "last_seen": time.time()}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    uid = data.user_id
    
    # Защита от накрутки (базовая)
    if uid in USER_CACHE:
        old_score = USER_CACHE[uid]["data"].get("score", 0)
        # Разрешаем максимум 5000 очков за 10 секунд (учитывая PnL)
        if (data.score - old_score) > 5000:
            logger.warning(f"Аномалия у пользователя {uid}: +{data.score - old_score}")
            # Просто логируем, но сохраняем, чтобы не злить честных игроков
    
    USER_CACHE[uid] = {
        "data": data.model_dump(), 
        "last_seen": time.time()
    }
    return {"status": "ok"}

# Монтируем статику (index.html должен быть в static/)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"status": "error", "message": "index.html not found in static/"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
