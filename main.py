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

# --- [МАКСИМАЛЬНОЕ ЛОГИРОВАНИЕ] ---
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
# Твой токен и настройки (не меняем)
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
                logger.info(f"💾 [DB_SYNC] Успешно: {len(users_to_update)} юзеров за {time.time()-start_time:.3f}с")
        except Exception as e:
            logger.error(f"❌ [DB_ERROR] Критическая ошибка записи: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    logger.info("🚀 [INIT] Запуск жизненного цикла приложения...")
    
    # Проверка структуры папок перед запуском
    if not STATIC_DIR.exists():
        logger.error(f"⚠️ [WARN] Папка {STATIC_DIR} не найдена! Создаю пустую...")
        STATIC_DIR.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"📂 [INIT] Подключение к БД: {DB_PATH}")
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
    logger.info("✅ [INIT] БД инициализирована")
    
    try:
        from aiogram import Bot, Dispatcher, types
        from aiogram.filters import Command, CommandObject
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
        
        bot = Bot(token=API_TOKEN)
        dp = Dispatcher()
        
        @dp.message(Command("start"))
        async def start(m: types.Message, command: CommandObject):
            ref_id = command.args if command.args else ""
            logger.info(f"🤖 [TG] /start от {m.from_user.id} (ref: {ref_id})")
            url = f"{WEB_APP_URL}?tgWebAppStartParam={ref_id}"
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Играть в Neural Pulse 🚀", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse</b>\nТвой путь начинается здесь!", reply_markup=kb, parse_mode="HTML")
            
        asyncio.create_task(dp.start_polling(bot))
        app.state.bot = bot
        logger.info(f"✅ [TG] Бот @{(await bot.get_me()).username} запущен")
    except Exception as e:
        logger.error(f"❌ [TG_ERROR] Бот не запустился: {e}")

    asyncio.create_task(batch_db_update())
    yield
    if db_conn: 
        logger.info("🔌 [SHUTDOWN] Закрытие соединения с БД")
        await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API ЭНДПОИНТЫ] ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    uid = str(user_id)
    now = int(time.time())
    logger.info(f"➡️ [API] Запрос баланса для {uid} (REF: {ref})")

    if uid in USER_CACHE:
        logger.info(f"⚡ [CACHE] Возврат данных {uid} из памяти")
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance")
        data["tap_power"] = data.pop("click_lvl")
        # Расчет прибыли за время отсутствия
        passed = now - data.get('last_active', now)
        income = (data['pnl'] / 3600) * passed
        data['score'] += income
        USER_CACHE[uid] = {"data": data, "last_seen": now}
        logger.info(f"📂 [DB] Юзер {uid} загружен. Оффлайн доход: +{income:.2f}")
        return {"status": "ok", "data": data}
    
    # Новый пользователь
    logger.info(f"🆕 [NEW] Регистрация {uid}")
    start_bal = 0.0
    if ref and ref != uid:
        try:
            await db_conn.execute("UPDATE users SET balance = balance + 10000 WHERE id = ?", (ref,))
            await db_conn.execute("INSERT OR IGNORE INTO referrals (referrer_id, friend_id, bonus_given) VALUES (?, ?, 1)", (ref, uid))
            await db_conn.commit()
            start_bal = 5000.0
            logger.info(f"🎁 [REF] Бонусы за приглашение применены")
        except Exception as e:
            logger.error(f"❌ [REF_ERR] {e}")

    new_data = {"score": start_bal, "tap_power": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}
    USER_CACHE[uid] = {"data": new_data, "last_seen": now}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    uid = str(data.user_id)
    if uid in USER_CACHE:
        old = USER_CACHE[uid]["data"].get("score", 0)
        # logger.info(f"💾 [SAVE] {uid} | Score: {data.score} (Diff: {data.score - old})")
    USER_CACHE[uid] = {"data": data.model_dump(), "last_seen": time.time()}
    return {"status": "ok"}

@app.post("/api/claim-task")
async def claim_task(payload: TaskClaim):
    uid, tid = payload.user_id, payload.task_id
    logger.info(f"🎯 [TASK] Юзер {uid} проверяет задание {tid}")
    
    if tid == "sub_tg":
        try:
            member = await app.state.bot.get_chat_member(chat_id=CHANNEL_ID, user_id=int(uid))
            if member.status in ["left", "kicked"]:
                logger.warning(f"🚫 [TASK] {uid} не подписан!")
                return {"status": "error", "message": "Подпишитесь на канал!"}
        except Exception as e:
            logger.error(f"❌ [TASK_ERR] Ошибка API Telegram: {e}")
            return {"status": "error", "message": "Ошибка проверки"}

    reward = next((t["reward"] for t in AVAILABLE_TASKS if t["id"] == tid), 0)
    try:
        await db_conn.execute("INSERT INTO completed_tasks (user_id, task_id, completed_at) VALUES (?, ?, ?)", (uid, tid, int(time.time())))
        await db_conn.commit()
        if uid in USER_CACHE:
            USER_CACHE[uid]["data"]["score"] += reward
            logger.info(f"💰 [TASK] {uid} получил {reward} за {tid}")
            return {"status": "ok", "new_balance": USER_CACHE[uid]["data"]["score"]}
    except:
        logger.warning(f"⚠️ [TASK] Повторная попытка для {uid} и {tid}")
        return {"status": "error", "message": "Уже выполнено"}

@app.get("/api/leaderboard")
async def leaderboard():
    logger.info("🏆 [LEADERBOARD] Запрос топа")
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT id, balance, level FROM users ORDER BY balance DESC LIMIT 10") as cur:
        rows = await cur.fetchall()
    return {"status": "ok", "leaders": [{"rank": i+1, "user_id": r["id"], "score": r["balance"], "level": r["level"]} for i, r in enumerate(rows)]}

# --- [РАБОТА СО СТАТИКОЙ] ---

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    logger.info(f"📁 [WEB] Папка static примонтирована")

@app.get("/")
async def index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        logger.info("📄 [WEB] Отправка index.html")
        return FileResponse(index_file)
    logger.error("❌ [WEB] index.html НЕ НАЙДЕН в папке static")
    return JSONResponse({"error": "Frontend missing"}, status_code=404)

@app.get("/tonconnect-manifest.json")
async def manifest():
    m_file = STATIC_DIR / "tonconnect-manifest.json"
    if m_file.exists(): return FileResponse(m_file)
    return JSONResponse({"error": "Not found"}, status_code=404)

if __name__ == "__main__":
    logger.info(f"🌍 [SERVER] Старт на http://0.0.0.0:3000")
    uvicorn.run(app, host="0.0.0.0", port=3000)
