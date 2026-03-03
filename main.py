import os, asyncio, logging, time, datetime, sys
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update, FSInputFile
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandObject, Command

# --- [STAGE 0] НАСТРОЙКИ ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = BASE_DIR / "images"

# Глобальная переменная для БД, чтобы не переоткрывать её 1000 раз
db_conn: Optional[aiosqlite.Connection] = None

def log_step(category: str, message: str, color: str = "\033[92m"):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"\033[1m[{curr_time}]\033[0m {color}{category.ljust(12)}\033[0m | {message}", flush=True)

# --- SCHEMAS ---
class SaveData(BaseModel):
    model_config = ConfigDict(extra="allow")
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int
    exp: int
    wallet: Optional[str] = None

# --- LIFESPAN (ТУТ САМАЯ СКОРОСТЬ) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("SYSTEM", "ENGINE OVERCLOCKING...", "\033[95m")
    
    # 1. Открываем ОДНО соединение на всё время работы
    db_conn = await aiosqlite.connect(DB_PATH)
    db_conn.row_factory = aiosqlite.Row
    
    # 2. Экстремальные настройки скорости SQLite
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=OFF") # Рискованно, но ОЧЕНЬ быстро
    await db_conn.execute("PRAGMA cache_size=-128000") # 128MB кэша в RAM
    await db_conn.execute("PRAGMA locking_mode=EXCLUSIVE") # Только этот процесс владеет БД
    
    await db_conn.execute('''CREATE TABLE IF NOT EXISTS users 
        (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
         energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
         level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0,
         wallet TEXT DEFAULT NULL, referrer_id TEXT DEFAULT NULL, referrals_count INTEGER DEFAULT 0,
         ref_balance REAL DEFAULT 0, tasks_completed TEXT DEFAULT "")''')
    await db_conn.commit()
    
    # 3. Настройка бота
    webhook_url = f"https://np.bothost.ru/webhook"
    bot = Bot(token="8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU")
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    
    yield
    # Закрываем всё при выключении
    await db_conn.close()
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

# Ускоряем передачу статики и API
app.add_middleware(GZipMiddleware, minimum_size=200)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API (БЕЗ ПЕРЕОТКРЫТИЯ БД) ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        user = await cursor.fetchone()
    
    if not user:
        await db_conn.execute("INSERT INTO users (id, balance, last_active) VALUES (?, 1000, ?)", (user_id, int(time.time())))
        await db_conn.commit()
        return {"status": "ok", "balance": 1000}
    
    return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    # Мгновенное сохранение через уже открытое соединение
    await db_conn.execute(
        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, wallet=?, last_active=? WHERE id=?", 
        (data.score, data.click_lvl, data.energy, data.max_energy, data.pnl, data.level, data.exp, data.wallet, int(time.time()), data.user_id)
    )
    await db_conn.commit()
    return {"status": "ok"}

# --- СТАТИКА (ЗАПОМНИЛ: static/index.html) ---
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")



@app.get("/")
async def index():
    # Браузер Telegram кэширует файл, вход становится почти мгновенным
    return FileResponse(STATIC_DIR / "index.html", headers={
        "Cache-Control": "public, max-age=3600",
        "X-Speed-Mode": "Turbo-Activated"
    })

if __name__ == "__main__":
    # Отключаем логи access_log, чтобы не тратить CPU на вывод текста
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=False, http="httptools")
