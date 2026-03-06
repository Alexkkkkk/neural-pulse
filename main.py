import os, asyncio, logging, time, sys
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, Union
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict

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
# ВАЖНО: index.html лежит в /static по твоим требованиям
STATIC_DIR = BASE_DIR / "static"

API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM" 
# ВАЖНО: Убираем лишний слеш в конце для корректной работы параметров
WEB_APP_URL = "https://np.bothost.ru"
CHANNEL_ID = "@UltraMind_AI_bot" # Укажи ID своего канала для проверки подписки

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

AVAILABLE_TASKS = [
    {"id": "sub_tg", "name": "Join Neural Channel", "reward": 5000, "link": "https://t.me/UltraMind_AI_bot"},
]

class SaveData(BaseModel):
    user_id: Union[str, int]
    score: float = 0
    energy: float = 0
    max_energy: int = 1000
    pnl: float = 0
    level: int = 1
    tap_power: int = 1
    wallet_address: Optional[str] = None
    model_config = ConfigDict(extra='allow')

class TaskClaim(BaseModel):
    user_id: str
    task_id: str

# --- [БАЗА ДАННЫХ] ---
async def batch_db_update():
    """Фоновое сохранение кэша в БД каждые 15 секунд"""
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        try:
            start_time = time.time()
            users_to_update = []
            for uid, entry in list(USER_CACHE.items()):
                d = entry.get("data")
                if not d: continue
                # Преобразование данных для записи
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
                logger.info(f"💾 [DB_SYNC] Обновлено: {len(users_to_update)} юзеров")
        except Exception as e:
            logger.error(f"❌ [DB_ERROR] Ошибка синхронизации: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    logger.info("🚀 [INIT] Запуск системы...")
    
    # Инициализация БД
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
            energy REAL, max_energy INTEGER, pnl REAL, 
            level INTEGER, wallet_address TEXT, last_active INTEGER
        );
        CREATE TABLE IF NOT EXISTS referrals (
            referrer_id TEXT, friend_id TEXT, bonus_given INTEGER DEFAULT 0,
            PRIMARY KEY (referrer_id, friend_id)
        );
        CREATE TABLE IF NOT EXISTS completed_tasks (
            user_id TEXT, task_id TEXT, completed_at INTEGER,
            PRIMARY KEY (user_id, task_id)
        );
    """)
    await db_conn.commit()
    
    # Запуск бота через aiogram
    try:
        from aiogram import Bot, Dispatcher, types
        from aiogram.filters import Command, CommandObject
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
        
        bot = Bot(token=API_TOKEN)
        dp = Dispatcher()
        
        @dp.message(Command("start"))
        async def start(m: types.Message, command: CommandObject):
            ref_id = command.args if command.args else ""
            # Формируем URL с параметром реферала
            url = f"{WEB_APP_URL}/?tgWebAppStartParam={ref_id}" if ref_id else WEB_APP_URL
            
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Играть в Neural Pulse 🚀", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse Online</b>\n\nСистема готова к работе, агент {m.from_user.first_name}.", reply_markup=kb, parse_mode="HTML")
            
        asyncio.create_task(dp.start_polling(bot))
        app.state.bot = bot
        logger.info("✅ [TG_BOT] Бот запущен")
    except Exception as e:
        logger.error(f"❌ [TG_ERROR] Ошибка бота: {e}")

    asyncio.create_task(batch_db_update())
    yield
    if db_conn: await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API ЭНДПОИНТЫ] ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    uid = str(user_id)
    now = int(time.time())

    # 1. Проверяем кэш
    if uid in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    # 2. Ищем в БД
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        # Маппинг имен полей БД на поля фронтенда
        data["score"] = data.pop("balance")
        data["tap_power"] = data.pop("click_lvl")
        # Расчет пассивного дохода за время отсутствия
        passed = now - data.get('last_active', now)
        income = (data['pnl'] / 3600) * passed
        data['score'] += income
        USER_CACHE[uid] = {"data": data, "last_seen": now}
        return {"status": "ok", "data": data}
    
    # 3. Регистрация нового юзера
    start_bal = 0.0
    if ref and ref != uid: # Нельзя пригласить самого себя
        try:
            # Проверяем существование реферера
            async with db_conn.execute("SELECT id FROM users WHERE id = ?", (ref,)) as c:
                if await c.fetchone():
                    await db_conn.execute("UPDATE users SET balance = balance + 10000 WHERE id = ?", (ref,))
                    await db_conn.execute("INSERT OR IGNORE INTO referrals (referrer_id, friend_id, bonus_given) VALUES (?, ?, 1)", (ref, uid))
                    start_bal = 5000.0
                    await db_conn.commit()
                    logger.info(f"🎁 Реферал {uid} принес бонус {ref}")
        except Exception as e:
            logger.error(f"Ошибка реферала: {e}")

    new_data = {"score": start_bal, "tap_power": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}
    USER_CACHE[uid] = {"data": new_data, "last_seen": now}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    uid = str(data.user_id)
    USER_CACHE[uid] = {"data": data.model_dump(), "last_seen": time.time()}
    return {"status": "ok"}

@app.get("/api/leaderboard")
async def leaderboard():
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT id, balance, level FROM users ORDER BY balance DESC LIMIT 10") as cur:
        rows = await cur.fetchall()
    return {"status": "ok", "leaders": [{"rank": i+1, "user_id": r["id"], "score": r["balance"], "level": r["level"]} for i, r in enumerate(rows)]}

# --- [СТАТИКА И FRONTEND] ---

# 1. Манифест для TON Connect должен быть доступен по прямому пути
@app.get("/tonconnect-manifest.json")
async def get_manifest():
    file_path = STATIC_DIR / "tonconnect-manifest.json"
    if file_path.exists():
        return FileResponse(file_path)
    return JSONResponse({"error": "not found"}, status_code=404)

# 2. Главная страница (Mini App)
@app.get("/")
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse({"error": "Frontend missing"}, status_code=404)

# 3. Остальные файлы (картинки, стили)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
