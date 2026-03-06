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
# Настроено так, чтобы в консоли Bothost всё было красиво и понятно
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
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

# --- [БАЗА ДАННЫХ И СИНХРОНИЗАЦИЯ] ---
async def batch_db_update():
    """Фоновое сохранение кэша в БД каждые 15 секунд с полной проверкой"""
    logger.info("🛠️ [DB_WORKER] Фоновый процесс сохранения запущен.")
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn:
            continue
            
        start_time = time.time()
        try:
            users_to_update = []
            # Работаем с копией кэша, чтобы не блокировать основной поток
            current_cache = list(USER_CACHE.items())
            
            for uid, entry in current_cache:
                d = entry.get("data")
                if not d: continue
                
                users_to_update.append((
                    str(uid), 
                    float(d.get('score', 0)), 
                    int(d.get('tap_power', 1)), 
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
                        balance=excluded.balance, 
                        click_lvl=excluded.click_lvl,
                        energy=excluded.energy, 
                        max_energy=excluded.max_energy,
                        pnl=excluded.pnl, 
                        level=excluded.level, 
                        wallet_address=excluded.wallet_address, 
                        last_active=excluded.last_active
                """, users_to_update)
                await db_conn.commit()
                duration = round(time.time() - start_time, 3)
                logger.info(f"💾 [DB_SYNC] Успех! Обновлено: {len(users_to_update)} юзеров за {duration} сек.")
            
            # Очистка памяти: удаляем юзеров, которые не заходили более 2 часов
            limit = time.time() - 7200
            inactive = [uid for uid, entry in current_cache if entry.get("last_seen", 0) < limit]
            for uid in inactive:
                del USER_CACHE[uid]
            if inactive: logger.info(f"🧹 [CLEANUP] Удалено из памяти {len(inactive)} неактивных сессий.")

        except Exception as e:
            logger.error(f"❌ [DB_ERROR] Критическая ошибка записи: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    app.state.ready = False 
    logger.info("🚀 [INIT] Запуск Neural Pulse Core...")
    
    try:
        # 1. Подключение БД с оптимизацией под Bothost (SQLite)
        db_conn = await aiosqlite.connect(DB_PATH)
        # WAL режим позволяет читать базу во время записи
        await db_conn.execute("PRAGMA journal_mode=WAL")
        await db_conn.execute("PRAGMA synchronous=NORMAL")
        
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
        """)
        await db_conn.commit()
        logger.info("📡 [DB] База данных готова и оптимизирована (WAL Mode ON)")
        
        # 2. Запуск бота через aiogram
        from aiogram import Bot, Dispatcher, types
        from aiogram.filters import Command, CommandObject
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
        
        bot = Bot(token=API_TOKEN)
        dp = Dispatcher()
        
        @dp.message(Command("start"))
        async def start_cmd(m: types.Message, command: CommandObject):
            ref_id = command.args if command.args else ""
            url = f"{WEB_APP_URL}/?tgWebAppStartParam={ref_id}" if ref_id else WEB_APP_URL
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Играть 🧠", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse Online</b>\nДобро пожаловать, {m.from_user.first_name}!\nТвой мозг — твой капитал.", reply_markup=kb, parse_mode="HTML")
            logger.info(f"🤖 [TG] Команда /start от {m.from_user.id} (ref: {ref_id})")
            
        asyncio.create_task(dp.start_polling(bot))
        logger.info("✅ [TG_BOT] Бот активен и слушает сообщения")

        # 3. Запуск фоновых задач
        asyncio.create_task(batch_db_update())
        
        app.state.ready = True
        logger.info("🌟 [SERVER] Все системы в норме. ПРИЕМ ТРАФИКА РАЗРЕШЕН.")
        
    except Exception as e:
        logger.critical(f"💥 [FATAL_ERROR] Ошибка инициализации: {e}")
        app.state.ready = False
    
    yield
    logger.info("🛑 [SHUTDOWN] Остановка сервера...")
    if db_conn: await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API ЭНДПОИНТЫ] ---

@app.get("/api/health")
async def health_check():
    """Синхронизация с Docker HEALTHCHECK"""
    if getattr(app.state, "ready", False):
        return {"status": "ready", "timestamp": time.time()}
    return JSONResponse({"status": "starting"}, status_code=503)

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    if not getattr(app.state, "ready", False):
        return JSONResponse({"status": "error", "msg": "core_booting"}, status_code=503)

    uid = str(user_id)
    now = int(time.time())

    # 1. Проверка в кэше
    if uid in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    # 2. Загрузка из БД
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        frontend_data = {
            "score": data["balance"],
            "tap_power": data["click_lvl"],
            "energy": data["energy"],
            "max_energy": data["max_energy"],
            "pnl": data["pnl"],
            "level": data["level"],
            "wallet_address": data["wallet_address"]
        }
        
        # Начисление офлайн дохода (PRO логика)
        if data.get('last_active'):
            passed = now - data['last_active']
            if passed > 0 and frontend_data['pnl'] > 0:
                income = (frontend_data['pnl'] / 3600) * passed
                frontend_data['score'] += income
                logger.info(f"💰 [ECONOMY] Юзер {uid} получил {round(income, 2)} за простой.")
                
        USER_CACHE[uid] = {"data": frontend_data, "last_seen": now}
        return {"status": "ok", "data": frontend_data}
    
    # 3. Регистрация нового юзера
    logger.info(f"🆕 [USER] Регистрация нового агента: {uid}")
    start_bal = 0.0
    if ref and ref != uid:
        async with db_conn.execute("SELECT id FROM users WHERE id = ?", (ref,)) as c:
            if await c.fetchone():
                await db_conn.execute("UPDATE users SET balance = balance + 10000 WHERE id = ?", (ref,))
                await db_conn.execute("INSERT OR IGNORE INTO referrals (referrer_id, friend_id, bonus_given) VALUES (?, ?, 1)", (ref, uid))
                start_bal = 5000.0
                await db_conn.commit()
                logger.info(f"🎁 [REF] {ref} пригласил {uid}. Бонусы начислены.")

    new_user = {
        "score": start_bal, "tap_power": 1, "energy": 1000.0, 
        "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None
    }
    USER_CACHE[uid] = {"data": new_user, "last_seen": now}
    return {"status": "ok", "data": new_user}

@app.post("/api/save")
async def save(data: SaveData):
    uid = str(data.user_id)
    # Быстрое обновление в памяти
    USER_CACHE[uid] = {"data": data.model_dump(), "last_seen": time.time()}
    return {"status": "ok"}

# --- [СТАТИКА] ---

@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/tonconnect-manifest.json")
async def get_manifest():
    return FileResponse(STATIC_DIR / "tonconnect-manifest.json")

# Монтируем статику ПОСЛЕ всех API маршрутов
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    logger.info(f"📁 [STATIC] Папка /static успешно подключена")

if __name__ == "__main__":
    # Запуск через uvicorn с настройками для Bothost
    logger.info("⚙️ [STARTUP] Запуск uvicorn сервера...")
    uvicorn.run(app, host="0.0.0.0", port=3000, log_config=None)
