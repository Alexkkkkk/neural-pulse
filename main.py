import os, asyncio, logging, time, sys
import aiosqlite
import uvicorn
import aiohttp
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, Union, List
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict

# --- [НАСТРОЙКА ЛОГИРОВАНИЯ] ---
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
WEB_APP_URL = "https://np.bothost.ru/"
CHANNEL_ID = "@your_channel_id" 

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

AVAILABLE_TASKS = [
    {"id": "sub_tg", "name": "Join Neural Channel", "reward": 5000, "link": "https://t.me/your_channel"},
    {"id": "follow_x", "name": "Follow Pulse X", "reward": 3000, "link": "https://x.com/your_profile"},
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

# --- [ФОНОВЫЕ ЗАДАЧИ] ---
async def batch_db_update():
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        try:
            start_time = time.time()
            users_to_update = []
            for uid, entry in list(USER_CACHE.items()):
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
                logger.info(f"💾 [DB_SYNC] Синхронизировано {len(users_to_update)} юзеров за {time.time()-start_time:.3f}с")
        except Exception as e:
            logger.error(f"❌ [DB_ERROR] Ошибка синхронизации: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    logger.info("🚀 [STARTUP] Инициализация системы...")
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
    
    try:
        from aiogram import Bot, Dispatcher, types
        from aiogram.filters import Command, CommandObject
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
        
        bot = Bot(token=API_TOKEN)
        dp = Dispatcher()
        
        @dp.message(Command("start"))
        async def start(m: types.Message, command: CommandObject):
            ref_id = command.args if command.args else ""
            logger.info(f"🤖 [TG_BOT] Команда /start от {m.from_user.id} (ref: {ref_id})")
            url = f"{WEB_APP_URL}?tgWebAppStartParam={ref_id}"
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Играть в Neural Pulse 🚀", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse</b>\nДобро пожаловать!", reply_markup=kb, parse_mode="HTML")
            
        asyncio.create_task(dp.start_polling(bot))
        app.state.bot = bot
        logger.info("✅ [TG_BOT] Бот успешно запущен")
    except Exception as e:
        logger.warning(f"⚠️ [TG_BOT] Ошибка запуска: {e}")

    asyncio.create_task(batch_db_update())
    yield
    if db_conn: await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API ЭНДПОИНТЫ С ПОСТРОЧНЫМ ЛОГИРОВАНИЕМ] ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    uid = str(user_id)
    now = int(time.time())
    logger.info(f"📥 [GET_BALANCE] Запрос от {uid} (ref: {ref})")

    if uid in USER_CACHE:
        logger.info(f"⚡ [CACHE_HIT] Данные {uid} взяты из памяти")
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance")
        data["tap_power"] = data.pop("click_lvl")
        passed = now - data.get('last_active', now)
        income = (data['pnl'] / 3600) * passed
        data['score'] += income
        USER_CACHE[uid] = {"data": data, "last_seen": now}
        logger.info(f"📂 [DB_LOAD] {uid} загружен. Оффлайн доход: +{income:.2f}")
        return {"status": "ok", "data": data}
    
    # Регистрация
    start_bal = 0.0
    logger.info(f"🆕 [USER_NEW] Регистрация нового игрока: {uid}")
    if ref and ref != uid:
        try:
            await db_conn.execute("UPDATE users SET balance = balance + 10000 WHERE id = ?", (ref,))
            await db_conn.execute("INSERT OR IGNORE INTO referrals (referrer_id, friend_id, bonus_given) VALUES (?, ?, 1)", (ref, uid))
            await db_conn.commit()
            start_bal = 5000.0
            logger.info(f"🎁 [REF_BONUS] {ref} получил 10к за приглашение {uid}")
        except Exception as e:
            logger.error(f"❌ [REF_ERR] Ошибка реферала: {e}")

    new_data = {"score": start_bal, "tap_power": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}
    USER_CACHE[uid] = {"data": new_data, "last_seen": now}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    uid = str(data.user_id)
    if uid in USER_CACHE:
        old_score = USER_CACHE[uid]["data"].get("score", 0)
        diff = data.score - old_score
        if diff > 10000:
             logger.warning(f"🛡️ [ANTI_CHEAT] Большой скачок у {uid}: +{diff:.2f} за раз!")
            
    USER_CACHE[uid] = {"data": data.model_dump(), "last_seen": time.time()}
    # logger.debug(f"💾 [SAVE] Данные {uid} обновлены в кэше")
    return {"status": "ok"}

@app.post("/api/claim-task")
async def claim_task(payload: TaskClaim):
    uid, tid = payload.user_id, payload.task_id
    logger.info(f"🎯 [TASK_CLAIM] {uid} пытается забрать {tid}")
    
    if tid == "sub_tg":
        try:
            member = await app.state.bot.get_chat_member(chat_id=CHANNEL_ID, user_id=int(uid))
            if member.status in ["left", "kicked"]:
                logger.warning(f"🚫 [TASK_FAIL] {uid} не подписан на {CHANNEL_ID}")
                return {"status": "error", "message": "Подпишитесь на канал!"}
            logger.info(f"✅ [TASK_SUCCESS] Подписка {uid} подтверждена")
        except Exception as e:
            logger.error(f"❌ [SUB_CHECK_ERR] {e}")
            return {"status": "error", "message": "Тех. ошибка проверки"}

    reward = next((t["reward"] for t in AVAILABLE_TASKS if t["id"] == tid), 0)
    try:
        await db_conn.execute("INSERT INTO completed_tasks (user_id, task_id, completed_at) VALUES (?, ?, ?)", (uid, tid, int(time.time())))
        await db_conn.commit()
        if uid in USER_CACHE:
            USER_CACHE[uid]["data"]["score"] += reward
            logger.info(f"💰 [REWARD] {uid} получил {reward} за {tid}")
            return {"status": "ok", "new_balance": USER_CACHE[uid]["data"]["score"]}
    except Exception:
        logger.warning(f"⚠️ [TASK_DUP] {uid} уже выполнял {tid}")
        return {"status": "error", "message": "Уже выполнено"}

@app.get("/api/leaderboard")
async def leaderboard():
    logger.info("🏆 [LEADERBOARD] Запрос топа игроков")
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT id, balance, level FROM users ORDER BY balance DESC LIMIT 10") as cur:
        rows = await cur.fetchall()
    return {"status": "ok", "leaders": [{"rank": i+1, "user_id": r["id"], "score": r["balance"], "level": r["level"]} for i, r in enumerate(rows)]}

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    logger.info("🌍 [SERVER] Запуск на http://0.0.0.0:3000")
    uvicorn.run(app, host="0.0.0.0", port=3000)
