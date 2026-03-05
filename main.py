import os, asyncio, logging, time, datetime, sys
import aiosqlite
import uvicorn
import aiohttp  # Добавлено для запросов к API TON
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict

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
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"
WEB_APP_URL = "https://np.bothost.ru/"
ADMIN_WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"
# Рекомендуется получить бесплатный API ключ на https://toncenter.com/
TONCENTER_API_KEY = "" 

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
    click_lvl: Optional[int] = 1
    wallet_address: Optional[str] = None  
    referrer_id: Optional[str] = None
    model_config = ConfigDict(extra='allow')

class PaymentVerify(BaseModel):
    user_id: str
    amount: float

# --- [ФУНКЦИИ БЛОКЧЕЙНА] ---
async def verify_ton_tx(user_id: str, expected_ton: float):
    """Проверяет блокчейн на наличие оплаты с комментарием 'user_id'"""
    url = f"https://toncenter.com/api/v2/getTransactions?address={ADMIN_WALLET}&limit=15"
    headers = {"X-API-Key": TONCENTER_API_KEY} if TONCENTER_API_KEY else {}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200: return False
                data = await resp.json()
                
                for tx in data.get('result', []):
                    # Проверяем входящие сообщения
                    msg = tx.get('in_msg', {})
                    value = int(msg.get('value', 0)) / 1e9 # в TON
                    comment = msg.get('message', '')
                    
                    # Если сумма совпадает и в комментарии есть ID пользователя
                    if value >= expected_ton * 0.98 and str(user_id) in comment:
                        return True
    except Exception as e:
        logger.error(f"Ошибка проверки TON: {e}")
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
            logger.error(f"Ошибка БД: {e}")

# --- [LIFESPAN] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
            energy REAL, max_energy INTEGER, pnl REAL, 
            level INTEGER, wallet_address TEXT, last_active INTEGER
        )
    """)
    # Таблица для предметов майнинга (предметы пользователя)
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
                InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse</b>\nПривет! Майни токены и подключай TON.", reply_markup=kb, parse_mode="HTML")
        asyncio.create_task(dp.start_polling(bot))
    
    asyncio.create_task(batch_db_update())
    yield
    if db_conn: await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API ЭНДПОИНТЫ] ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    uid = str(user_id)
    if uid in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance")
        USER_CACHE[uid] = {"data": data, "last_seen": time.time()}
        return {"status": "ok", "data": data}
    
    start_bal = 5000.0 if ref and ref != uid else 0.0
    new_data = {"score": start_bal, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}
    USER_CACHE[uid] = {"data": new_data, "last_seen": time.time()}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    USER_CACHE[data.user_id] = {"data": data.model_dump(), "last_seen": time.time()}
    return {"status": "ok"}

@app.post("/api/verify-payment")
async def verify_payment(payload: PaymentVerify):
    """Эндпоинт для ручной проверки платежа из приложения"""
    success = await verify_ton_tx(payload.user_id, payload.amount)
    if success:
        # Если это был Boost энергии
        if payload.amount == 0.1:
            if payload.user_id in USER_CACHE:
                USER_CACHE[payload.user_id]["data"]["energy"] = USER_CACHE[payload.user_id]["data"]["max_energy"]
            return {"status": "ok", "message": "Оплата подтверждена! Энергия восстановлена."}
    return {"status": "error", "message": "Транзакция не найдена. Подождите 1-2 минуты."}

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
