import os, asyncio, logging, time, datetime, sys, json, traceback
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, List, Any
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, field_validator
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [КОНФИГУРАЦИЯ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
# index.html всегда в папке static по твоим правилам
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"

C = {"G": "\033[92m", "Y": "\033[93m", "R": "\033[91m", "B": "\033[1m", "P": "\033[95m", "E": "\033[0m"}

def log_step(cat: str, msg: str, col: str = C["G"]):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C['B']}[{curr_time}]{C['E']} {col}{cat.ljust(12)}{C['E']} | {msg}", flush=True)

# --- [ИНИЦИАЛИЗАЦИЯ] ---
STATIC_DIR.mkdir(parents=True, exist_ok=True)
bot = Bot(token=API_TOKEN)
dp = Dispatcher()
USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

class SaveData(BaseModel):
    user_id: str
    score: float = 0.0
    click_lvl: int = 1
    energy: float = 0.0
    max_energy: int = 1000
    pnl: float = 0.0
    level: int = 1
    exp: int = 0

    @field_validator('score', 'energy', 'pnl', mode='before')
    @classmethod
    def to_float(cls, v):
        try: return float(v) if v is not None else 0.0
        except: return 0.0

    @field_validator('click_lvl', 'max_energy', 'level', 'exp', mode='before')
    @classmethod
    def to_int(cls, v):
        try: return int(float(v)) if v is not None else 1
        except: return 1

# --- [ОБРАБОТЧИКИ ТЕЛЕГРАМ] ---
@dp.message(F.text == "/start")
async def start_cmd(message: types.Message):
    uid = str(message.from_user.id)
    log_step("TG_MSG", f"Команда /start от {uid}", C["Y"])
    
    if db_conn:
        await db_conn.execute("INSERT OR IGNORE INTO users (id, balance) VALUES (?, ?)", (uid, 1000.0))
        await db_conn.commit()
        log_step("DB_ACTION", f"Регистрация/Вход: {uid}", C["G"])

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))],
        [InlineKeyboardButton(text="Поддержка 💬", url="https://t.me/bothost_ru")]
    ])
    await message.answer(
        f"<b>Привет, {message.from_user.first_name}!</b>\nСистема Neural Pulse онлайн и готова к работе.",
        reply_markup=kb, parse_mode="HTML"
    )

# --- [ФОНОВЫЙ ЦИКЛ] ---
async def maintenance_loop():
    log_step("SYSTEM", "Цикл синхронизации запущен", C["P"])
    while True:
        try:
            await asyncio.sleep(60)
            if USER_CACHE and db_conn:
                count = 0
                for uid in list(USER_CACHE.keys()):
                    cache_entry = USER_CACHE.get(uid)
                    if not cache_entry: continue
                    d = cache_entry.get("data")
                    if not d: continue
                    
                    await db_conn.execute(
                        """UPDATE users SET 
                           balance=?, click_lvl=?, energy=?, max_energy=?, 
                           pnl=?, level=?, exp=?, last_active=? 
                           WHERE id=?""",
                        (d.get('score'), d.get('click_lvl'), d.get('energy'), d.get('max_energy'),
                         d.get('pnl'), d.get('level'), d.get('exp'), int(time.time()), str(uid))
                    )
                    count += 1
                await db_conn.commit()
                if count > 0:
                    log_step("DB_SYNC", f"Обновлено игроков: {count}", C["G"])
        except Exception as e:
            log_step("LOOP_ERR", f"Ошибка: {e}", C["R"])

# --- [LIFESPAN] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("STARTUP", ">>> ЗАПУСК СЕРВЕРА NEURAL PULSE <<<", C["B"])
    try:
        db_conn = await aiosqlite.connect(DB_PATH)
        await db_conn.execute("PRAGMA journal_mode=WAL")
        await db_conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
                energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
                level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0
            )
        """)
        await db_conn.commit()
        log_step("DB_READY", "База данных подключена", C["G"])
        
        await bot.delete_webhook(drop_pending_updates=True)
        polling_task = asyncio.create_task(dp.start_polling(bot))
        sync_task = asyncio.create_task(maintenance_loop())
        
        yield
        
        log_step("SHUTDOWN", "Остановка сервера...", C["Y"])
        polling_task.cancel()
        sync_task.cancel()
        await db_conn.close()
    except Exception as e:
        log_step("FATAL", f"Критический сбой: {e}", C["R"])

# --- [FASTAPI ПРИЛОЖЕНИЕ] ---
app = FastAPI(lifespan=lifespan)

# CORS настроен максимально широко для Telegram WebApp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return JSONResponse({"status": "no_favicon"})

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    if uid in USER_CACHE: 
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    if not db_conn: return JSONResponse({"status": "error", "msg": "DB offline"}, 500)

    try:
        db_conn.row_factory = aiosqlite.Row
        async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cursor:
            user = await cursor.fetchone()
        
        if not user:
            new_d = {"score": 1000.0, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "exp": 0}
            await db_conn.execute("INSERT OR IGNORE INTO users (id, balance) VALUES (?, ?)", (uid, 1000.0))
            await db_conn.commit()
            USER_CACHE[uid] = {"data": new_d}
            return {"status": "ok", "data": new_d}
        
        res = dict(user)
        res["score"] = res.pop("balance") 
        USER_CACHE[uid] = {"data": res}
        return {"status": "ok", "data": res}
    except Exception as e:
        return JSONResponse({"status": "error", "msg": str(e)}, 500)

@app.post("/api/save")
async def save_game(data: SaveData):
    uid = str(data.user_id)
    if uid not in USER_CACHE: USER_CACHE[uid] = {"data": {}}
    USER_CACHE[uid]["data"].update(data.model_dump(exclude_unset=True))
    return {"status": "ok"}

@app.get("/api/jackpot")
async def get_jackpot():
    try:
        if not db_conn: return {"status": "ok", "value": 500000}
        async with db_conn.execute("SELECT SUM(balance) FROM users") as cursor:
            row = await cursor.fetchone()
            total = row[0] if row and row[0] is not None else 0
            return {"status": "ok", "value": int(500000 + total)}
    except:
        return {"status": "ok", "value": 500000}

@app.get("/api/leaderboard")
async def get_top():
    if not db_conn: return {"status": "ok", "data": []}
    try:
        db_conn.row_factory = aiosqlite.Row
        async with db_conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as cursor:
            rows = await cursor.fetchall()
        return {"status": "ok", "data": [{"id": r["id"], "balance": r["balance"]} for r in rows]}
    except:
        return {"status": "ok", "data": []}

@app.get("/")
async def index():
    p = STATIC_DIR / "index.html"
    if p.exists(): 
        # Добавляем заголовки, чтобы браузер не кэшировал старый дизайн
        return FileResponse(p, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return JSONResponse({"err": "index.html not found in static/"}, 404)

# Монтируем статику ПОСЛЕ всех маршрутов API
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    target_port = int(os.environ.get("PORT", 3000))
    # Запуск с оптимальными настройками для Bothost
    uvicorn.run(app, host="0.0.0.0", port=target_port, proxy_headers=True, forwarded_allow_ips="*")
