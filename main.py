import os, asyncio, logging, time, datetime
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
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update

# --- НАСТРОЙКИ (ЗАПОМНЕНО: index.html в static/) ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = BASE_DIR / "images"

# ЛОКАЛЬНЫЙ КЭШ ДАННЫХ
USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

def log_step(category: str, message: str, color: str = "\033[92m"):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"\033[1m[{curr_time}]\033[0m {color}{category.ljust(12)}\033[0m | {message}", flush=True)

class SaveData(BaseModel):
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int
    exp: int

# --- СИНХРОНИЗАЦИЯ КЭША ---
async def sync_cache_to_db():
    while True:
        await asyncio.sleep(30) # Сохраняем на диск каждые 30 сек
        if USER_CACHE and db_conn:
            try:
                for uid, info in USER_CACHE.items():
                    d = info["data"]
                    await db_conn.execute(
                        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, last_active=? WHERE id=?",
                        (d['score'], d['click_lvl'], d['energy'], d['max_energy'], d['pnl'], d['level'], d['exp'], int(time.time()), uid)
                    )
                await db_conn.commit()
                log_step("DB_SYNC", f"Данные {len(USER_CACHE)} игроков сохранены", "\033[96m")
            except Exception as e:
                log_step("DB_ERR", str(e), "\033[91m")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=OFF")
    await db_conn.execute('''CREATE TABLE IF NOT EXISTS users 
        (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
         energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
         level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)''')
    await db_conn.commit()
    asyncio.create_task(sync_cache_to_db())
    yield
    await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=200)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ---
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    if user_id in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[user_id]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        user = await cursor.fetchone()
    
    if not user:
        return {"status": "ok", "data": {"balance": 1000, "level": 1, "energy": 1000}}
    
    u_dict = dict(user)
    USER_CACHE[user_id] = {"data": u_dict, "last_save": time.time()}
    return {"status": "ok", "data": u_dict}

@app.post("/api/save")
async def save_game(data: SaveData):
    USER_CACHE[data.user_id] = {"data": data.model_dump(), "last_save": time.time()}
    return {"status": "ok"}

# --- ТУРБО-КЭШ ДЛЯ СТАТИКИ ---
# Применяем заголовки кэширования для всех файлов в /images и /static
class CachedStaticFiles(StaticFiles):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        # Кэшируем картинки и скрипты на 7 дней (604800 секунд)
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        return response

app.mount("/images", CachedStaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/static", CachedStaticFiles(directory=str(STATIC_DIR)), name="static")



@app.get("/")
async def index():
    return FileResponse(
        STATIC_DIR / "index.html", 
        headers={
            "Cache-Control": "public, max-age=3600", # Индекс кэшируем на час
            "X-Turbo": "Enabled"
        }
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=False)
