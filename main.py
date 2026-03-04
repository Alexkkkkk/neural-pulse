import os, asyncio, logging, time, datetime, sys, json, traceback
import aiosqlite
import uvicorn
import psutil
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [КОНФИГУРАЦИЯ ПУТЕЙ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"  # Папка static всегда здесь
ADMIN_ID = 476014374 
API_TOKEN = "8257287930:AAGMADWoM4PUoZu8OhmnOOtKyaDlTLRWUn4"

# Авто-создание необходимых папок
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# --- [ЛОГИРОВАНИЕ] ---
C = {"G": "\033[92m", "Y": "\033[93m", "R": "\033[91m", "B": "\033[1m", "P": "\033[95m", "E": "\033[0m"}

def log_step(cat: str, msg: str, col: str = C["G"]):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C['B']}[{curr_time}]{C['E']} {col}{cat.ljust(12)}{C['E']} | {msg}", flush=True)

# --- [БОТ И ДАННЫЕ] ---
bot = Bot(token=API_TOKEN)
dp = Dispatcher()
USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

class SaveData(BaseModel):
    user_id: str
    score: Optional[float] = None
    click_lvl: Optional[int] = None
    energy: Optional[float] = None
    max_energy: Optional[int] = None
    pnl: Optional[float] = None
    level: Optional[int] = None
    exp: Optional[int] = None

# --- [ОБРАБОТЧИКИ ТЕЛЕГРАМ] ---
@dp.message(F.text == "/start")
async def start_cmd(message: types.Message):
    log_step("TG_MSG", f"Start от {message.from_user.id}", C["Y"])
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))]
    ])
    await message.answer(f"Привет, {message.from_user.first_name}! Твоя нейросеть готова к работе.", reply_markup=kb)

# --- [ФОНОВАЯ СИНХРОНИЗАЦИЯ С БД] ---
async def maintenance_loop():
    while True:
        try:
            await asyncio.sleep(60)
            if USER_CACHE and db_conn:
                for uid, cache in USER_CACHE.items():
                    d = cache.get("data")
                    if not d: continue
                    await db_conn.execute(
                        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, last_active=? WHERE id=?",
                        (d.get('score'), d.get('click_lvl'), d.get('energy'), d.get('max_energy'),
                         d.get('pnl'), d.get('level'), d.get('exp'), int(time.time()), str(uid))
                    )
                await db_conn.commit()
                log_step("DB_SAVE", f"Синхронизация кэша завершена ({len(USER_CACHE)} чел.)", C["P"])
        except Exception as e:
            log_step("DB_ERR", f"Ошибка БД: {e}", C["R"])

# --- [УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("STARTUP", ">>> Инициализация сервера <<<", C["B"])
    
    # 1. Настройка базы данных
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, 
            balance REAL DEFAULT 1000, 
            click_lvl INTEGER DEFAULT 1, 
            energy REAL DEFAULT 1000, 
            max_energy INTEGER DEFAULT 1000, 
            pnl REAL DEFAULT 0, 
            level INTEGER DEFAULT 1, 
            exp INTEGER DEFAULT 0, 
            last_active INTEGER DEFAULT 0
        )
    """)
    await db_conn.commit()
    
    # 2. Сброс вебхука (обязательно для Bothost)
    await bot.delete_webhook(drop_pending_updates=True)
    
    # 3. Запуск фоновых процессов
    polling_task = asyncio.create_task(dp.start_polling(bot))
    sync_task = asyncio.create_task(maintenance_loop())
    
    log_step("SYSTEM", "Бот и задачи запущены успешно ✅", C["G"])
    
    yield
    
    # Завершение работы
    polling_task.cancel()
    sync_task.cancel()
    await db_conn.close()

# --- [FASTAPI ПРИЛОЖЕНИЕ] ---
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# --- [API ЭНДПОИНТЫ] ---
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    if uid in USER_CACHE: 
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cursor:
        user = await cursor.fetchone()
        
    if not user:
        new_d = {"score": 1000, "click_lvl": 1, "energy": 1000, "max_energy": 1000, "pnl": 0, "level": 1, "exp": 0}
        await db_conn.execute("INSERT INTO users (id, balance) VALUES (?, ?)", (uid, 1000))
        await db_conn.commit()
        USER_CACHE[uid] = {"data": new_d}
        return {"status": "ok", "data": new_d}
    
    res = dict(user)
    res["score"] = res.pop("balance")
    USER_CACHE[uid] = {"data": res}
    return {"status": "ok", "data": res}

@app.post("/api/save")
async def save_game(data: SaveData):
    uid = str(data.user_id)
    if uid not in USER_CACHE: 
        USER_CACHE[uid] = {"data": {}}
    USER_CACHE[uid]["data"].update(data.model_dump(exclude_unset=True))
    return {"status": "ok"}

@app.get("/api/leaderboard")
async def get_leaderboard():
    try:
        db_conn.row_factory = aiosqlite.Row
        async with db_conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as cursor:
            rows = await cursor.fetchall()
            return {"status": "ok", "data": [dict(r) for r in rows]}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- [ОТОБРАЖЕНИЕ САЙТА] ---
@app.get("/")
async def index():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        return JSONResponse({"status": "error", "message": "index.html not found in static folder"}, status_code=404)
    return FileResponse(index_path)

# Монтируем статику в конце
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    # Динамический порт: берет из настроек хостинга или использует 3000
    target_port = int(os.environ.get("PORT", 3000))
    log_step("LAUNCH", f"Сервер запускается на порту: {target_port}", C["B"])
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=target_port, 
        proxy_headers=True, 
        forwarded_allow_ips="*"
    )
