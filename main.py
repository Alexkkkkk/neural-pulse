import os, asyncio, logging, time, datetime, sys
import aiosqlite
import uvicorn
import aiohttp
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, Union
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field

try:
    from aiogram import Bot, Dispatcher, types
    from aiogram.filters import Command, CommandObject
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    AIOGRAM_AVAILABLE = True
except ImportError:
    AIOGRAM_AVAILABLE = False

# --- [ЛОГИРОВАНИЕ] ---
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
WEB_APP_URL = "https://np.bothost.ru/"
ADMIN_WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"
# Вставь ключ от @tonapibot для быстрой проверки
TONCENTER_API_KEY = "" 

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

# --- [ИСПРАВЛЕННЫЕ МОДЕЛИ] ---
class SaveData(BaseModel):
    user_id: str
    score: float
    energy: float
    max_energy: int
    pnl: float
    level: int
    # Используем Union для корректной обработки null значений из JS
    click_lvl: Optional[int] = 1
    wallet_address: Optional[Union[str, None]] = None  
    referrer_id: Optional[str] = None
    
    # Ключевая настройка: игнорировать лишние поля и разрешать гибкие типы
    model_config = ConfigDict(extra='allow', arbitrary_types_allowed=True)

class PaymentVerify(BaseModel):
    user_id: str
    amount: float

# --- [ФУНКЦИИ БЛОКЧЕЙНА] ---
async def verify_ton_tx(user_id: str, expected_ton: float):
    """Проверяет входящие транзакции в сети TON"""
    url = f"https://toncenter.com/api/v2/getTransactions?address={ADMIN_WALLET}&limit=20"
    headers = {"X-API-Key": TONCENTER_API_KEY} if TONCENTER_API_KEY else {}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status != 200: return False
                data = await resp.json()
                
                for tx in data.get('result', []):
                    # Проверка входящего сообщения
                    in_msg = tx.get('in_msg', {})
                    if not in_msg: continue
                    
                    value = int(in_msg.get('value', 0)) / 1e9
                    comment = in_msg.get('message', '') # Комментарий пользователя
                    
                    # Проверяем сумму и наличие ID пользователя в комментарии
                    if value >= expected_ton * 0.95 and str(user_id) in comment:
                        logger.info(f"Платеж подтвержден для {user_id}: {value} TON")
                        return True
    except Exception as e:
        logger.error(f"Ошибка блокчейн-сервиса: {e}")
    return False

# --- [ФОНОВЫЕ ЗАДАЧИ] ---
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
                # Подготовка данных для пакетной вставки
                users_to_update.append((
                    str(uid), float(d.get('score', 0)), int(d.get('click_lvl', 1)), 
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
        except Exception as e:
            logger.error(f"Ошибка циклической записи: {e}")

# --- [LIFESPAN] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL") # Ускоряет работу БД
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
            energy REAL, max_energy INTEGER, pnl REAL, 
            level INTEGER, wallet_address TEXT, last_active INTEGER
        )
    """)
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            user_id TEXT, item_id TEXT, level INTEGER, 
            PRIMARY KEY(user_id, item_id)
        )
    """)
    await db_conn.commit()
    
    if AIOGRAM_AVAILABLE:
        bot = Bot(token=API_TOKEN)
        dp = Dispatcher()
        @dp.message(Command("start"))
        async def start(m: types.Message, command: CommandObject):
            ref_id = command.args if command.args else ""
            url = f"{WEB_APP_URL}?tgWebAppStartParam={ref_id}"
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Вход в Neural Pulse 🚀", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse</b>\nТвой мозг — это майнер. Начни добычу TON прямо сейчас!", 
                         reply_markup=kb, parse_mode="HTML")
        asyncio.create_task(dp.start_polling(bot))
    
    asyncio.create_task(batch_db_update())
    yield
    if db_conn: await db_conn.close()

# --- [APP SETUP] ---
app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    uid = str(user_id)
    if uid in USER_CACHE:
        USER_CACHE[uid]["last_seen"] = time.time()
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance") # Совместимость с фронтендом
        USER_CACHE[uid] = {"data": data, "last_seen": time.time()}
        return {"status": "ok", "data": data}
    
    start_bal = 5000.0 if (ref and ref != uid and ref != "") else 0.0
    new_data = {"score": start_bal, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}
    USER_CACHE[uid] = {"data": new_data, "last_seen": time.time()}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    # Теперь extra='allow' предотвратит ошибку 422
    USER_CACHE[data.user_id] = {
        "data": data.model_dump(),
        "last_seen": time.time()
    }
    return {"status": "ok"}

@app.post("/api/verify-payment")
async def verify_payment(payload: PaymentVerify):
    success = await verify_ton_tx(payload.user_id, payload.amount)
    if success:
        if payload.amount >= 0.1: # 0.1 TON за Boost
            if payload.user_id in USER_CACHE:
                USER_CACHE[payload.user_id]["data"]["energy"] = USER_CACHE[payload.user_id]["data"]["max_energy"]
                return {"status": "ok", "message": "Энергия полностью восстановлена!"}
    return {"status": "error", "message": "Транзакция не найдена. Если вы оплатили, подождите 60 сек."}

# Статика
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"error": "index.html not found in static/"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
