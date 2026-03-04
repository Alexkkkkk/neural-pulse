import os, asyncio, logging, time, datetime, sys, json, traceback
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, List
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [КОНФИГУРАЦИЯ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
# Путь к твоему логотипу
LOGO_PATH = STATIC_DIR / "logo.png"

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

# ИСПРАВЛЕННАЯ МОДЕЛЬ ДЛЯ ИСКЛЮЧЕНИЯ ОШИБКИ 422
class SaveData(BaseModel):
    user_id: str
    score: Optional[float] = 0.0
    click_lvl: Optional[int] = 1
    energy: Optional[float] = 0.0
    max_energy: Optional[int] = 1000
    pnl: Optional[float] = 0.0
    level: Optional[int] = 1
    exp: Optional[int] = 0

# --- [ОБРАБОТЧИКИ ТЕЛЕГРАМ] ---
@dp.message(F.text == "/start")
async def start_cmd(message: types.Message):
    uid = str(message.from_user.id)
    log_step("TG_MSG", f"Команда /start от {uid}", C["Y"])
    
    async with db_conn.execute("SELECT id FROM users WHERE id = ?", (uid,)) as cursor:
        if not await cursor.fetchone():
            await db_conn.execute("INSERT INTO users (id, balance) VALUES (?, ?)", (uid, 1000))
            await db_conn.commit()
            log_step("DB_ACTION", f"Новый игрок: {uid}")

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))]
    ])
    await message.answer(f"<b>Привет, {message.from_user.first_name}!</b>\nСистема готова к работе.", reply_markup=kb, parse_mode="HTML")

# --- [ФОНОВЫЙ ЦИКЛ] ---
async def maintenance_loop():
    while True:
        try:
            me = await bot.get_me()
            log_step("PING", f"Связь OK: @{me.username}", C["G"])
            
            if USER_CACHE and db_conn:
                for uid, cache in USER_CACHE.items():
                    d = cache.get("data")
                    if not d: continue
                    await db_conn.execute(
                        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, last_active=? WHERE id=?",
                        (float(d.get('score', 0)), int(d.get('click_lvl', 1)), float(d.get('energy', 0)), 
                         int(d.get('max_energy', 1000)), float(d.get('pnl', 0)), int(d.get('level', 1)), 
                         int(d.get('exp', 0)), int(time.time()), str(uid))
                    )
                await db_conn.commit()
                log_step("DB_SYNC", f"Синхронизировано игроков: {len(USER_CACHE)}", C["G"])
            await asyncio.sleep(60)
        except Exception as e:
            log_step("LOOP_ERR", f"Ошибка: {e}", C["R"])
            await asyncio.sleep(10)

# --- [LIFESPAN] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)")
    await db_conn.commit()
    await bot.delete_webhook(drop_pending_updates=True)
    asyncio.create_task(dp.start_polling(bot))
    asyncio.create_task(maintenance_loop())
    yield
    await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API] ---
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    if uid in USER_CACHE: return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cursor:
        user = await cursor.fetchone()
    if not user:
        d = {"score": 1000.0, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "exp": 0}
        USER_CACHE[uid] = {"data": d}
        return {"status": "ok", "data": d}
    res = dict(user)
    res["score"] = res.pop("balance")
    USER_CACHE[uid] = {"data": res}
    return {"status": "ok", "data": res}

@app.post("/api/save")
async def save_game(data: SaveData):
    uid = str(data.user_id)
    if uid not in USER_CACHE: USER_CACHE[uid] = {"data": {}}
    USER_CACHE[uid]["data"].update(data.model_dump(exclude_unset=True))
    log_step("API_SAVE", f"Кэш обновлен для {uid}", C["P"])
    return {"status": "ok"}

@app.get("/api/leaderboard")
async def get_top():
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as cursor:
        rows = await cursor.fetchall()
    return {"status": "ok", "data": [dict(r) for r in rows]}

# --- [STATIC & LOGO] ---
@app.get("/favicon.ico")
async def favicon():
    if LOGO_PATH.exists(): return FileResponse(LOGO_PATH)
    return JSONResponse({"err": "no logo"}, 404)

@app.get("/")
async def index():
    p = STATIC_DIR / "index.html"
    if p.exists(): return FileResponse(p)
    return JSONResponse({"err": "not found"}, 404)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, proxy_headers=True, forwarded_allow_ips="*")
