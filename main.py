import os, asyncio, logging, time, datetime, sys
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# --- [НОВОЕ: ИМПОРТЫ ДЛЯ TG] ---
from aiogram import Bot, Dispatcher, types
from aiogram.types import Update

# --- [КОНФИГ И ЦВЕТА] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = BASE_DIR / "images"
BACKUP_DIR = BASE_DIR / "backups"

# ВСТАВЬ СВОЙ ТОКЕН СЮДА:
API_TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU" 

C = {"G": "\033[92m", "Y": "\033[93m", "R": "\033[91m", "C": "\033[96m", "B": "\033[1m", "E": "\033[0m"}

def log_step(cat: str, msg: str, col: str = C["G"]):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C['B']}[{curr_time}]{C['E']} {col}{cat.ljust(10)}{C['E']} | {msg}", flush=True)

# Инициализация TG объектов
bot = Bot(token=API_TOKEN)
dp = Dispatcher()

# --- [STAGE 1] ПОДГОТОВКА ФС ---
for folder in [STATIC_DIR, IMAGES_DIR, BACKUP_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

class SaveData(BaseModel):
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int
    exp: int

# --- [STAGE 2] TG ХЭНДЛЕРЫ ---

@dp.message()
async def handle_message(message: types.Message):
    """Этот код будет писать в логи Bothost каждое сообщение"""
    user = message.from_user
    log_step("TG_MSG", f"От: {user.full_name} (@{user.username}) | Текст: {message.text}", C["B"] + C["C"])
    
    if message.text == "/start":
        await message.answer(f"Привет, {user.first_name}! Я тебя вижу в логах Bothost.")

# --- [STAGE 3] ОБСЛУЖИВАНИЕ ---

async def create_backup():
    try:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
        backup_file = BACKUP_DIR / f"game_backup_{timestamp}.db"
        async with aiosqlite.connect(DB_PATH) as src:
            async with aiosqlite.connect(backup_file) as dst:
                await src.backup(dst)
        log_step("BACKUP", f"Создана копия: {backup_file.name}", C["G"])
        backups = sorted(list(BACKUP_DIR.glob("*.db")), key=os.path.getmtime)
        while len(backups) > 5:
            old_file = backups.pop(0)
            os.remove(old_file)
            log_step("CLEANUP", f"Старый бэкап удален: {old_file.name}", C["Y"])
    except Exception as e:
        log_step("BK_ERR", f"Ошибка бэкапа: {e}", C["R"])

async def maintenance_loop():
    log_step("SYSTEM", "Цикл обслуживания запущен", C["C"])
    last_backup_time = time.time()
    while True:
        try:
            await asyncio.sleep(60)
            if USER_CACHE and db_conn:
                current_cache = USER_CACHE.copy()
                for uid, info in current_cache.items():
                    d = info["data"]
                    await db_conn.execute(
                        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, last_active=? WHERE id=?",
                        (d['score'], d['click_lvl'], d['energy'], d['max_energy'], d['pnl'], d['level'], d['exp'], int(time.time()), uid)
                    )
                await db_conn.commit()
                log_step("DB_SYNC", f"Сохранено игроков: {len(current_cache)}")
                if len(USER_CACHE) > 500:
                    USER_CACHE.clear()
                    log_step("MEMORY", "Очистка кэша", C["Y"])
            if time.time() - last_backup_time > 43200:
                await create_backup()
                last_backup_time = time.time()
        except Exception as e:
            log_step("LOOP_ERR", f"Сбой цикла: {e}", C["R"])

# --- [STAGE 4] LIFESPAN ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("DB_START", "Запуск SQLite (WAL mode)...")
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=NORMAL")
    await db_conn.execute('''CREATE TABLE IF NOT EXISTS users 
        (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
         energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
         level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)''')
    await db_conn.commit()
    
    await create_backup()
    
    # Установка Webhook
    webhook_url = "https://np.bothost.ru/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    log_step("TG_SYSTEM", f"Webhook установлен: {webhook_url}", C["C"])
    
    m_task = asyncio.create_task(maintenance_loop())
    log_step("SYSTEM", "Neural Pulse Engine готов!", C["B"] + C["G"])
    
    yield
    
    m_task.cancel()
    await bot.delete_webhook()
    if db_conn:
        await db_conn.close()
    log_step("SYSTEM", "Сервер остановлен", C["Y"])

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [STAGE 5] ЭНДПОИНТЫ ---

@app.post("/webhook")
async def telegram_webhook(request: Request):
    """Принимает сигналы от Telegram"""
    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"status": "ok"}
    except Exception as e:
        log_step("TG_ERR", f"Ошибка обработки вебхука: {e}", C["R"])
        return JSONResponse({"status": "error"}, status_code=500)

@app.get("/health")
async def health():
    return {"status": "ok", "cache": len(USER_CACHE)}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    if user_id in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[user_id]["data"]}
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        user = await cursor.fetchone()
    if not user:
        return {"status": "ok", "data": {"balance": 1000, "level": 1}}
    u_dict = dict(user)
    USER_CACHE[user_id] = {"data": u_dict, "last_save": time.time()}
    return {"status": "ok", "data": u_dict}

@app.post("/api/save")
async def save_game(data: SaveData):
    USER_CACHE[data.user_id] = {"data": data.model_dump(), "last_save": time.time()}
    return {"status": "ok"}

# --- [STAGE 6] СТАТИКА ---

class CachedStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        return response

app.mount("/images", CachedStaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/static", CachedStaticFiles(directory=str(STATIC_DIR)), name="static")



@app.get("/")
async def index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        log_step("ERROR", "index.html не найден!", C["R"])
        return JSONResponse({"error": "File missing"}, status_code=404)
    return FileResponse(index_file, headers={"Cache-Control": "public, max-age=3600"})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, access_log=False, workers=1)
