import os, asyncio, logging, time, datetime, sys, json, traceback
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
from aiogram.types import Update

# --- [КОНФИГ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static" 
IMAGES_DIR = STATIC_DIR / "images"

for folder in [STATIC_DIR, IMAGES_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

API_TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU" 
WEBHOOK_URL = "https://np.bothost.ru/webhook"

C = {"G": "\033[92m", "Y": "\033[93m", "R": "\033[91m", "C": "\033[96m", "B": "\033[1m", "E": "\033[0m"}

def log_step(cat: str, msg: str, col: str = C["G"]):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C['B']}[{curr_time}]{C['E']} {col}{cat.ljust(12)}{C['E']} | {msg}", flush=True)

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

# --- [TG ХЭНДЛЕРЫ] ---
@dp.message()
async def handle_message(message: types.Message):
    try:
        log_step("MSG_IN", f"Текст: {message.text} от {message.from_user.id}", C["Y"])
        if message.text == "/start":
            kb = types.InlineKeyboardMarkup(inline_keyboard=[
                [types.InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=types.WebAppInfo(url="https://np.bothost.ru/"))]
            ])
            await message.answer(
                f"Привет, {message.from_user.first_name}! Твоя нейросеть готова.\nЖми на кнопку ниже!", 
                reply_markup=kb
            )
            log_step("ACTION", "Ответ отправлен ✅")
    except Exception as e:
        log_step("AIOGRAM_ERR", str(e), C["R"])

# --- [СИСТЕМА] ---
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
                log_step("DB_SYNC", "Данные сохранены")
        except Exception: pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("STARTUP", "Инициализация БД...")
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)")
    await db_conn.commit()
    
    # В гибридном режиме удаляем вебхук, чтобы работал Polling
    await bot.delete_webhook(drop_pending_updates=True)
    log_step("SYSTEM", "Webhook удален для работы Polling")
    
    # Запускаем фоновый опрос Telegram
    asyncio.create_task(dp.start_polling(bot))
    log_step("POLLING", "Бот запущен в режиме прямого опроса ✅")
    
    m_task = asyncio.create_task(maintenance_loop())
    yield
    m_task.cancel()
    await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/ping")
async def ping():
    return {"status": "alive", "mode": "hybrid", "time": str(datetime.datetime.now())}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    if uid in USER_CACHE: return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cursor:
        user = await cursor.fetchone()
    if not user:
        new_data = {"score": 1000, "click_lvl": 1, "energy": 1000, "max_energy": 1000, "pnl": 0, "level": 1, "exp": 0}
        await db_conn.execute("INSERT INTO users (id, balance) VALUES (?, ?)", (uid, 1000))
        await db_conn.commit()
        USER_CACHE[uid] = {"data": new_data}
        return {"status": "ok", "data": new_data}
    res = dict(user); res["score"] = res.pop("balance")
    USER_CACHE[uid] = {"data": res}
    return {"status": "ok", "data": res}

@app.post("/api/save")
async def save_game(data: SaveData):
    uid = str(data.user_id)
    if uid not in USER_CACHE: USER_CACHE[uid] = {"data": {}}
    USER_CACHE[uid]["data"].update(data.model_dump(exclude_unset=True))
    return {"status": "ok"}

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    # Оставляем 8080, если ты его настроил в панели, иначе смени на 3000
    log_step("SERVER", "Запуск веб-сервера...")
    uvicorn.run("main:app", host="0.0.0.0", port=8080, proxy_headers=True, forwarded_allow_ips="*")
