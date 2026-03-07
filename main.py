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
# Настраиваем формат так, чтобы в Bothost всё было красиво и читаемо
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

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None
bot_instance: Optional[Bot] = None

class SaveData(BaseModel):
    user_id: str
    score: float = 0.0
    energy: float = 0.0
    max_energy: int = 1000
    pnl: float = 0.0
    level: int = 1
    tap_power: int = 1
    wallet_address: Optional[str] = None
    model_config = ConfigDict(extra='allow')

# --- [БАЗА ДАННЫХ] ---
async def batch_db_update():
    logger.info("🛠️ [DB_WORKER] Фоновый процесс сохранения запущен.")
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        try:
            users_to_update = []
            # Берем текущие ключи, чтобы не было ошибок RuntimeError при изменении словаря
            keys = list(USER_CACHE.keys())
            
            for uid in keys:
                # Извлекаем данные и удаляем из кэша (pop атомарен)
                entry = USER_CACHE.pop(uid, None)
                if not entry: continue
                d = entry.get("data")
                if not d: continue
                
                users_to_update.append((
                    str(uid), float(d.get('score', 0)), int(d.get('tap_power', 1)), 
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
                logger.info(f"💾 [DB_SYNC] Синхронизировано юзеров: {len(users_to_update)}")
        except Exception as e:
            logger.error(f"❌ [DB_ERROR] Ошибка записи: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn, bot_instance
    app.state.ready = False 
    try:
        logger.info("📡 [INIT] Подключение к базе данных...")
        db_conn = await aiosqlite.connect(DB_PATH)
        await db_conn.execute("PRAGMA journal_mode=WAL")
        await db_conn.execute("PRAGMA synchronous=NORMAL")
        await db_conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
                energy REAL, max_energy INTEGER, pnl REAL, 
                level INTEGER, wallet_address TEXT, last_active INTEGER
            );
        """)
        await db_conn.commit()
        
        logger.info("🤖 [INIT] Запуск Telegram бота...")
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
            
        asyncio.create_task(dp.start_polling(bot_instance))
        asyncio.create_task(batch_db_update())
        
        app.state.ready = True
        logger.info("🌟 [SERVER] Мозг ИИ успешно активирован и готов к работе.")
    except Exception as e:
        logger.critical(f"💥 Ошибка старта: {e}")
    
    yield
    
    if bot_instance:
        await bot_instance.session.close()
    if db_conn: 
        await db_conn.close()
    logger.info("💤 [SERVER] Сервер остановлен.")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# --- [API ЭНДПОИНТЫ] ---

@app.get("/api/health")
async def health():
    return {"status": "ok", "ready": getattr(app.state, "ready", False)}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    if not getattr(app.state, "ready", False) or not db_conn: 
        return JSONResponse({"status": "error", "message": "Starting..."}, 503)
    
    uid = str(user_id)
    now = int(time.time())
    
    try:
        db_conn.row_factory = aiosqlite.Row
        async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
            row = await cur.fetchone()
        
        if row:
            data = dict(row)
            f_data = {
                "score": float(data["balance"]), 
                "tap_power": int(data["click_lvl"]),
                "energy": float(data["energy"]), 
                "max_energy": int(data["max_energy"]),
                "pnl": float(data["pnl"]), 
                "level": int(data["level"]), 
                "wallet_address": data["wallet_address"]
            }
            logger.info(f"📥 [API] Загружен баланс для юзера {uid}")
            return {"status": "ok", "data": f_data}
        
        # Создание нового пользователя
        start_bal = 5000.0 if (ref and ref != uid) else 0.0
        new_user = {"score": start_bal, "tap_power": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}
        
        await db_conn.execute(
            "INSERT INTO users (id, balance, click_lvl, energy, max_energy, pnl, level, last_active) VALUES (?,?,?,?,?,?,?,?)",
            (uid, start_bal, 1, 1000.0, 1000, 0.0, 1, now)
        )
        await db_conn.commit()
        logger.info(f"🆕 [API] Зарегистрирован новый юзер {uid} (Бонус: {start_bal})")
        return {"status": "ok", "data": new_user}
        
    except Exception as e:
        logger.error(f"❌ [BALANCE_ERROR] {e}")
        return JSONResponse({"status": "error"}, 500)

@app.post("/api/save")
async def save(data: SaveData):
    # Логируем сохранение для отладки
    # logger.info(f"📤 [API] Получены данные сохранения для {data.user_id}")
    USER_CACHE[str(data.user_id)] = {"data": data.model_dump(), "last_seen": time.time()}
    return {"status": "ok"}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    fav = STATIC_DIR / "images" / "favicon.ico"
    return FileResponse(fav) if fav.exists() else Response(status_code=204)

# --- [СТАТИКА] ---

@app.get("/")
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    logger.error("🚨 [ERROR] index.html не найден в папке static!")
    return JSONResponse({"error": "Frontend not found"}, 404)

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    # access_log=True оставляет логи каждого HTTP запроса (GET / API...)
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=True)
