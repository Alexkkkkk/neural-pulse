import os, asyncio, logging, time, datetime, sys, json, traceback
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, List, Any
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, field_validator
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandObject, Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [КОНФИГУРАЦИЯ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
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
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int
    exp: int

    @field_validator('score', 'energy', 'pnl', mode='before')
    @classmethod
    def to_float(cls, v):
        try: return float(v)
        except: return 0.0

    @field_validator('click_lvl', 'max_energy', 'level', 'exp', mode='before')
    @classmethod
    def to_int(cls, v):
        try: return int(float(v))
        except: return 1

# --- [ОБРАБОТЧИКИ ТЕЛЕГРАМ] ---
@dp.message(Command("start"))
async def start_cmd(message: types.Message, command: CommandObject):
    uid = str(message.from_user.id)
    ref_id = command.args
    log_step("TG_MSG", f"Команда /start от {uid} (Ref: {ref_id})", C["Y"])
    
    if db_conn:
        # Проверяем, есть ли пользователь в базе
        async with db_conn.execute("SELECT id FROM users WHERE id = ?", (uid,)) as cur:
            user_exists = await cur.fetchone()
        
        if not user_exists:
            # Только для новых игроков создаем запись и даем бонусы
            await db_conn.execute("INSERT INTO users (id, balance) VALUES (?, ?)", (uid, 1000.0))
            if ref_id and ref_id.isdigit() and ref_id != uid:
                await db_conn.execute("UPDATE users SET balance = balance + 50000 WHERE id = ?", (ref_id,))
                await db_conn.execute("UPDATE users SET balance = balance + 10000 WHERE id = ?", (uid,))
                log_step("REFERRAL", f"Бонусы начислены: {ref_id} -> {uid}", C["P"])
            await db_conn.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))],
        [InlineKeyboardButton(text="Поддержка 💬", url="https://t.me/bothost_ru")]
    ])
    
    welcome_text = (
        f"<b>Привет, {message.from_user.first_name}!</b>\n"
        f"Neural Pulse Online запущен.\n\n"
        f"🔗 Твоя реф. ссылка:\n<code>https://t.me/neural_pulse_bot?start={uid}</code>"
    )
    await message.answer(welcome_text, reply_markup=kb, parse_mode="HTML")

# --- [ФОНОВЫЙ ЦИКЛ] ---
async def maintenance_loop():
    while True:
        await asyncio.sleep(15)
        if USER_CACHE and db_conn:
            try:
                for uid, cache_entry in list(USER_CACHE.items()):
                    d = cache_entry.get("data")
                    if not d: continue
                    await db_conn.execute(
                        """UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, 
                           pnl=?, level=?, exp=?, last_active=? WHERE id=?""",
                        (float(d.get('score', 0)), int(d.get('click_lvl', 1)), float(d.get('energy', 0)), 
                         int(d.get('max_energy', 1000)), float(d.get('pnl', 0)), int(d.get('level', 1)), 
                         int(d.get('exp', 0)), int(time.time()), str(uid))
                    )
                await db_conn.commit()
                log_step("DB_SYNC", f"Синхронизация {len(USER_CACHE)} игроков")
            except Exception as e:
                log_step("DB_ERR", f"Ошибка: {e}", C["R"])

# --- [LIFESPAN] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("STARTUP", ">>> ЗАПУСК СЕРВЕРА NEURAL PULSE <<<", C["B"])
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
    asyncio.create_task(dp.start_polling(bot))
    asyncio.create_task(maintenance_loop())
    yield
    if db_conn: await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    if uid in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cursor:
        user = await cursor.fetchone()
    
    if not user:
        initial = {"score": 1000.0, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "exp": 0}
        # Используем INSERT OR IGNORE для безопасности
        await db_conn.execute("INSERT OR IGNORE INTO users (id, balance) VALUES (?, ?)", (uid, 1000.0))
        await db_conn.commit()
        USER_CACHE[uid] = {"data": initial}
        return {"status": "ok", "data": initial}
    
    res = dict(user)
    res["score"] = res.pop("balance")
    USER_CACHE[uid] = {"data": res}
    return {"status": "ok", "data": res}

@app.post("/api/save")
async def save_game(data: SaveData):
    USER_CACHE[str(data.user_id)] = {"data": data.model_dump()}
    return {"status": "ok"}

@app.get("/api/jackpot")
async def get_jackpot():
    async with db_conn.execute("SELECT SUM(balance) FROM users") as cursor:
        row = await cursor.fetchone()
        total = row[0] if row and row[0] else 0
        return {"status": "ok", "value": int(500000 + total)}

@app.get("/")
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    return FileResponse(index_path, headers={"Cache-Control": "no-store"}) if index_path.exists() else JSONResponse({"err": "no index"}, 404)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if (STATIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 3000)), timeout_keep_alive=30)
