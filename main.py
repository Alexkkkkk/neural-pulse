import os, asyncio, logging, time, datetime
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandObject, Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [КОНФИГУРАЦИЯ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"

# Кэш в оперативной памяти для скорости
USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

# --- [МОДЕЛИ] ---
class SaveData(BaseModel):
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int

# --- [ЛОГИКА БАЗЫ ДАННЫХ ДЛЯ МИЛЛИОНОВ ЮЗЕРОВ] ---
async def batch_db_update():
    """ Пакетное сохранение данных из кэша в БД каждые 15 секунд """
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn:
            continue
        
        try:
            # Подготавливаем данные для массовой вставки/обновления
            users_to_update = []
            for uid, entry in list(USER_CACHE.items()):
                d = entry.get("data")
                if not d: continue
                users_to_update.append((
                    str(uid), float(d['score']), int(d['click_lvl']), 
                    float(d['energy']), int(d['max_energy']), 
                    float(d['pnl']), int(d['level']), int(time.time())
                ))

            if users_to_update:
                # Массовая вставка: если юзер есть - обновить, если нет - вставить
                await db_conn.executemany("""
                    INSERT INTO users (id, balance, click_lvl, energy, max_energy, pnl, level, last_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance,
                        click_lvl=excluded.click_lvl,
                        energy=excluded.energy,
                        max_energy=excluded.max_energy,
                        pnl=excluded.pnl,
                        level=excluded.level,
                        last_active=excluded.last_active
                """, users_to_update)
                await db_conn.commit()
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] BATCH_SYNC: {len(users_to_update)} users")
        except Exception as e:
            print(f"DB_BATCH_ERROR: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    # Настройки для экстремальной скорости SQLite
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=NORMAL")
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
            energy REAL, max_energy INTEGER, pnl REAL, 
            level INTEGER, last_active INTEGER
        )
    """)
    await db_conn.commit()
    
    bot = Bot(token=API_TOKEN)
    dp = Dispatcher()
    
    @dp.message(Command("start"))
    async def start(m: types.Message):
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))
        ]])
        await m.answer("<b>Добро пожаловать в Neural Pulse!</b>", reply_markup=kb, parse_mode="HTML")

    asyncio.create_task(dp.start_polling(bot))
    asyncio.create_task(batch_db_update())
    yield
    await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    # Сначала ищем в быстром кэше
    if uid in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    # Если нет в кэше — идем в БД
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance") # Совместимость с фронтом
        USER_CACHE[uid] = {"data": data}
        return {"status": "ok", "data": data}
    
    # Новый юзер
    new_data = {"score": 1000.0, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1}
    USER_CACHE[uid] = {"data": new_data}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    USER_CACHE[data.user_id] = {"data": data.model_dump()}
    return {"status": "ok"}

@app.get("/api/jackpot")
async def jackpot():
    return {"status": "ok", "value": 777000} # Заглушка для скорости

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
@app.get("/")
async def index(): return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
