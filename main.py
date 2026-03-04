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

# --- [НАСТРОЙКИ ПУТЕЙ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"  # Тут живет твой index.html
IMAGES_DIR = STATIC_DIR / "images"

# Гарантируем наличие папок
for folder in [STATIC_DIR, IMAGES_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

API_TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU" 

# --- [ЦВЕТНОЕ ЛОГИРОВАНИЕ] ---
C = {
    "G": "\033[92m", "Y": "\033[93m", "R": "\033[91m", 
    "C": "\033[96m", "B": "\033[1m", "P": "\033[95m", "E": "\033[0m"
}

def log_step(cat: str, msg: str, col: str = C["G"]):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C['B']}[{curr_time}]{C['E']} {col}{cat.ljust(12)}{C['E']} | {msg}", flush=True)

# --- [БОТ И ДИСПЕТЧЕР] ---
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

# --- [ОБРАБОТКА TG СООБЩЕНИЙ] ---
@dp.message()
async def handle_message(message: types.Message):
    try:
        user = message.from_user
        log_step("TG_RECV", f"Запрос от {user.id} ({user.username}): {message.text}", C["Y"])
        
        if message.text == "/start":
            kb = types.InlineKeyboardMarkup(inline_keyboard=[
                [types.InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=types.WebAppInfo(url="https://np.bothost.ru/"))]
            ])
            await message.answer(
                f"Привет, {user.first_name}! Твоя нейросеть готова.\nЖми на кнопку ниже!", 
                reply_markup=kb
            )
            log_step("TG_SEND", f"Кнопка WebApp отправлена пользователю {user.id}", C["G"])
    except Exception as e:
        log_step("TG_ERR", f"Ошибка хэндлера: {e}", C["R"])

# --- [ФОНОВАЯ ЗАПИСЬ В БД] ---
async def maintenance_loop():
    log_step("SYSTEM", "Цикл синхронизации БД активен (60 сек)", C["C"])
    while True:
        try:
            await asyncio.sleep(60)
            if USER_CACHE and db_conn:
                log_step("DB_SAVE", f"Синхронизация {len(USER_CACHE)} игроков...", C["P"])
                for uid, cache in USER_CACHE.items():
                    d = cache.get("data")
                    if not d: continue
                    await db_conn.execute(
                        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, last_active=? WHERE id=?",
                        (d.get('score'), d.get('click_lvl'), d.get('energy'), d.get('max_energy'),
                         d.get('pnl'), d.get('level'), d.get('exp'), int(time.time()), str(uid))
                    )
                await db_conn.commit()
                log_step("DB_SAVE", "Данные успешно сброшены на диск ✅")
        except Exception as e:
            log_step("DB_ERR", f"Ошибка сохранения: {e}", C["R"])

# --- [УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("STARTUP", ">>> Инициализация Neural Pulse Server <<<", C["B"])
    
    # БД
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)")
    await db_conn.commit()
    log_step("STARTUP", f"Файл базы данных {DB_PATH.name} подключен.")

    # Удаляем вебхук (чтобы работал Polling)
    await bot.delete_webhook(drop_pending_updates=True)
    log_step("STARTUP", "Webhook удален. Переход в режим POLLING.")
    
    # Запуск Polling и Sync в фоне
    polling_task = asyncio.create_task(dp.start_polling(bot))
    sync_task = asyncio.create_task(maintenance_loop())
    log_step("STARTUP", "Бот и фоновые задачи запущены! ✅")
    
    yield
    
    # Завершение
    polling_task.cancel()
    sync_task.cancel()
    await db_conn.close()
    log_step("SHUTDOWN", "Сервер остановлен, БД закрыта.")

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API ЭНДПОИНТЫ] ---

@app.get("/ping")
async def ping(request: Request):
    log_step("API_PING", f"Проверка связи от {request.client.host}", C["C"])
    return {"status": "alive", "port": 8080}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    log_step("API_LOAD", f"Загрузка данных для ID: {uid}")
    
    if uid in USER_CACHE:
        log_step("CACHE_HIT", f"Данные {uid} взяты из кэша", C["G"])
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cursor:
        user = await cursor.fetchone()
    
    if not user:
        log_step("API_NEW", f"Новый игрок: {uid}. Создаю запись.", C["Y"])
        new_data = {"score": 1000, "click_lvl": 1, "energy": 1000, "max_energy": 1000, "pnl": 0, "level": 1, "exp": 0}
        await db_conn.execute("INSERT INTO users (id, balance) VALUES (?, ?)", (uid, 1000))
        await db_conn.commit()
        USER_CACHE[uid] = {"data": new_data}
        return {"status": "ok", "data": new_data}
    
    res = dict(user)
    res["score"] = res.pop("balance")
    USER_CACHE[uid] = {"data": res}
    return {"status": "ok", "data": res}

@app.post("/api/save")
async def save_game(data: SaveData):
    uid = str(data.user_id)
    log_step("API_SAVE", f"Обновление кэша для {uid}", C["P"])
    if uid not in USER_CACHE: USER_CACHE[uid] = {"data": {}}
    USER_CACHE[uid]["data"].update(data.model_dump(exclude_unset=True))
    return {"status": "ok"}

@app.get("/")
async def index():
    log_step("STATIC", "Раздача index.html")
    return FileResponse(STATIC_DIR / "index.html")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    log_step("SERVER", "Старт Uvicorn (Порт 8080)...", C["B"])
    uvicorn.run("main:app", host="0.0.0.0", port=8080, proxy_headers=True, forwarded_allow_ips="*")
