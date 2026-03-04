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
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [КОНФИГУРАЦИЯ И ЦВЕТА] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAGMADWoM4PUoZu8OhmnOOtKyaDlTLRWUn4"

C = {"G": "\033[92m", "Y": "\033[93m", "R": "\033[91m", "B": "\033[1m", "P": "\033[95m", "E": "\033[0m"}

def log_step(cat: str, msg: str, col: str = C["G"]):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C['B']}[{curr_time}]{C['E']} {col}{cat.ljust(12)}{C['E']} | {msg}", flush=True)

# Настройка стандартного логирования FastAPI/Uvicorn
logging.basicConfig(level=logging.INFO, format='%(message)s')

# --- [ИНИЦИАЛИЗАЦИЯ] ---
log_step("INIT", "Проверка папок проекта...")
STATIC_DIR.mkdir(parents=True, exist_ok=True)

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
    uid = str(message.from_user.id)
    log_step("TG_MSG", f"Команда /start от ID: {uid} (@{message.from_user.username})", C["Y"])
    
    try:
        async with db_conn.execute("SELECT id FROM users WHERE id = ?", (uid,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                log_step("DB_ACTION", f"Регистрация нового игрока {uid} в БД", C["G"])
                await db_conn.execute("INSERT INTO users (id, balance) VALUES (?, ?)", (uid, 1000))
                await db_conn.commit()
            else:
                log_step("DB_ACTION", f"Игрок {uid} уже существует", C["P"])
    except Exception as e:
        log_step("TG_ERR", f"Ошибка при проверке пользователя: {e}", C["R"])

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))],
        [InlineKeyboardButton(text="Поддержка 💬", url="https://t.me/bothost_ru")]
    ])
    
    await message.answer(
        f"<b>Привет, {message.from_user.first_name}!</b>\nТвоя нейросеть готова к работе.",
        reply_markup=kb, parse_mode="HTML"
    )

@dp.message(F.text)
async def all_msg_handler(message: types.Message):
    log_step("TG_CHAT", f"Сообщение от {message.from_user.id}: {message.text}", C["B"])

# --- [ФОНОВЫЙ ЦИКЛ] ---
async def maintenance_loop():
    log_step("SYSTEM", "Фоновый цикл синхронизации запущен", C["P"])
    while True:
        try:
            await asyncio.sleep(60)
            if USER_CACHE and db_conn:
                count = 0
                for uid, cache in USER_CACHE.items():
                    d = cache.get("data")
                    if not d: continue
                    await db_conn.execute(
                        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, last_active=? WHERE id=?",
                        (d.get('score'), d.get('click_lvl'), d.get('energy'), d.get('max_energy'),
                         d.get('pnl'), d.get('level'), d.get('exp'), int(time.time()), str(uid))
                    )
                    count += 1
                await db_conn.commit()
                if count > 0:
                    log_step("DB_SYNC", f"Успешно сохранено игроков: {count}", C["G"])
        except Exception as e:
            log_step("DB_ERR", f"Критическая ошибка синхронизации: {e}", C["R"])
            print(traceback.format_exc())

# --- [LIFESPAN] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("STARTUP", ">>> Инициализация сервера и БД <<<", C["B"])
    
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
        log_step("DB_READY", "База данных SQLite подключена и проверена")
        
        await bot.delete_webhook(drop_pending_updates=True)
        log_step("TG_READY", "Webhook сброшен, запуск Polling...")
        
        polling_task = asyncio.create_task(dp.start_polling(bot))
        sync_task = asyncio.create_task(maintenance_loop())
        
        log_step("SYSTEM", "Все системы запущены ✅", C["G"])
        yield
        
        log_step("SHUTDOWN", "Завершение работы...")
        polling_task.cancel()
        sync_task.cancel()
        await db_conn.close()
    except Exception as e:
        log_step("FATAL", f"Ошибка при старте: {e}", C["R"])
        print(traceback.format_exc())

# --- [FastAPI] ---
app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def log_requests(request: Request, call_next):
    log_step("HTTP_REQ", f"{request.method} {request.url.path}", C["B"])
    response = await call_next(request)
    return response

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    log_step("API_CALL", f"Запрос баланса для ID: {uid}")
    
    if uid in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cursor:
        user = await cursor.fetchone()
    
    if not user:
        log_step("API_DB", f"Пользователь {uid} не найден, создаю...", C["Y"])
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
    log_step("API_SAVE", f"Получены данные сохранения для {uid}", C["G"])
    if uid not in USER_CACHE: USER_CACHE[uid] = {"data": {}}
    USER_CACHE[uid]["data"].update(data.model_dump(exclude_unset=True))
    return {"status": "ok"}

@app.get("/")
async def index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        log_step("WEB", "Отдача index.html", C["G"])
        return FileResponse(index_path)
    log_step("WEB_ERR", "Файл index.html не найден в папке static!", C["R"])
    return JSONResponse({"err": "no index.html"}, 404)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    target_port = int(os.environ.get("PORT", 3000))
    log_step("LAUNCH", f"Сервер запускается на порту: {target_port}", C["B"])
    uvicorn.run("main:app", host="0.0.0.0", port=target_port, proxy_headers=True, forwarded_allow_ips="*")
