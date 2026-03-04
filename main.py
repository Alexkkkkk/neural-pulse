import os, asyncio, logging, time, datetime, sys, json, traceback
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, List, Any
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types
from aiogram.types import Update

# --- [КОНФИГ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static" # Всегда в папке static по инструкции
IMAGES_DIR = STATIC_DIR / "images"

for folder in [STATIC_DIR, IMAGES_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

API_TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU" 
# Чистый URL без слэша для регистрации
WEBHOOK_URL = "https://np.bothost.ru/webhook"

C = {"G": "\033[92m", "Y": "\033[93m", "R": "\033[91m", "C": "\033[96m", "B": "\033[1m", "E": "\033[0m"}

def log_step(cat: str, msg: str, col: str = C["G"]):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C['B']}[{curr_time}]{C['E']} {col}{cat.ljust(12)}{C['E']} | {msg}", flush=True)

logging.basicConfig(level=logging.INFO)
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
            # Твой дизайн и кнопки не меняем
            kb = types.InlineKeyboardMarkup(inline_keyboard=[
                [types.InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=types.WebAppInfo(url="https://np.bothost.ru/"))]
            ])
            await message.answer(
                f"Привет, {message.from_user.first_name}! Твоя нейросеть готова.\nЖми на кнопку ниже, чтобы начать!", 
                reply_markup=kb
            )
            log_step("ACTION", "Кнопка WebApp отправлена ✅")
    except Exception as e:
        log_step("AIOGRAM_ERR", f"Ошибка: {e}", C["R"])

# --- [СИСТЕМА] ---
async def maintenance_loop():
    log_step("SYSTEM", "Цикл фоновой записи активен", C["C"])
    while True:
        try:
            await asyncio.sleep(60)
            if USER_CACHE and db_conn:
                for uid, cache in USER_CACHE.items():
                    d = cache.get("data")
                    if not d: continue
                    await db_conn.execute(
                        """UPDATE users SET balance=COALESCE(?, balance), click_lvl=COALESCE(?, click_lvl), 
                           energy=COALESCE(?, energy), max_energy=COALESCE(?, max_energy), pnl=COALESCE(?, pnl), 
                           level=COALESCE(?, level), exp=COALESCE(?, exp), last_active=? WHERE id=?""",
                        (d.get('score'), d.get('click_lvl'), d.get('energy'), d.get('max_energy'),
                         d.get('pnl'), d.get('level'), d.get('exp'), int(time.time()), str(uid))
                    )
                await db_conn.commit()
                log_step("DB_SYNC", "Данные синхронизированы")
        except Exception: pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("STARTUP", "Запуск двигателя...")
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute('''CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)''')
    await db_conn.commit()
    
    # ПЕРЕУСТАНОВКА ВЕБХУКА
    log_step("WEBHOOK", "Регистрация в Telegram...")
    await bot.delete_webhook(drop_pending_updates=True)
    await asyncio.sleep(1)
    # Регистрируем без слэша, но принимать будем оба варианта
    await bot.set_webhook(url=WEBHOOK_URL, drop_pending_updates=True)
    
    info = await bot.get_webhook_info()
    log_step("WEBHOOK", f"Адрес установлен: {info.url} ✅")
    if info.last_error_message:
        log_step("WEBHOOK_ERR", f"Предыдущая ошибка TG: {info.last_error_message}", C["R"])
    
    m_task = asyncio.create_task(maintenance_loop())
    yield
    m_task.cancel()
    await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [ВХОД ДЛЯ TELEGRAM] ---

@app.post("/webhook")
@app.post("/webhook/")
async def telegram_webhook(request: Request):
    # Этот лог ДОЛЖЕН появиться при любом сообщении боту
    log_step("HIT", f"Сигнал от Telegram ({request.method})", C["G"])
    try:
        body = await request.body()
        if not body:
            log_step("HIT_WARN", "Пустое тело запроса", C["Y"])
            return {"status": "empty"}
            
        data = json.loads(body)
        update = Update.model_validate(data, context={"bot": bot})
        
        # Передаем обновление в диспетчер aiogram
        asyncio.create_task(dp.feed_update(bot, update))
        
        return {"status": "ok"}
    except Exception as e:
        log_step("WEBHOOK_ERR", f"Ошибка парсинга: {e}", C["R"])
        return JSONResponse(content={"status": "error"}, status_code=200)

@app.get("/debug")
async def debug():
    return {"status": "online", "db": db_conn is not None, "time": str(datetime.datetime.now())}

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
    # Обязательно port 3000 для Bothost
    uvicorn.run("main:app", host="0.0.0.0", port=3000, proxy_headers=True, forwarded_allow_ips="*")
