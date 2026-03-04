import os, asyncio, logging, time, datetime, sys, json, traceback
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, List
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types
from aiogram.types import Update

# --- [КОНФИГ И ПРОВЕРКА ФС] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = STATIC_DIR / "images"

# Гарантируем наличие папок
for folder in [STATIC_DIR, IMAGES_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

API_TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU" 
WEBHOOK_URL = "https://np.bothost.ru/webhook"

# Цвета для логов
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
        user_info = f"ID: {message.from_user.id} (@{message.from_user.username or 'no_user'})"
        log_step("AIOGRAM", f"Получено сообщение от {user_info}: {message.text or '[content]'}", C["C"])
        
        if message.text == "/start":
            log_step("ACTION", f"Генерация кнопки WebApp для {message.from_user.id}")
            kb = types.InlineKeyboardMarkup(inline_keyboard=[
                [types.InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=types.WebAppInfo(url="https://np.bothost.ru/"))]
            ])
            await message.answer(
                f"Привет, {message.from_user.first_name}! Твоя нейросеть готова к майнингу. Управляй ресурсами и выходи в ТОП!", 
                reply_markup=kb
            )
            log_step("ACTION", "Сообщение с кнопкой отправлено ✅")
    except Exception as e:
        log_step("AIOGRAM_ERR", f"Сбой хэндлера: {e}", C["R"])

# --- [ЦИКЛ ОБСЛУЖИВАНИЯ БД] ---
async def maintenance_loop():
    log_step("SYSTEM", "Цикл обслуживания БД запущен", C["C"])
    while True:
        try:
            await asyncio.sleep(60)
            if USER_CACHE and db_conn:
                log_step("DB_SYNC", f"Синхронизация {len(USER_CACHE)} активных игроков...")
                uids = list(USER_CACHE.keys())
                for uid in uids:
                    d = USER_CACHE[uid].get("data")
                    if not d: continue
                    await db_conn.execute(
                        """UPDATE users SET 
                           balance=COALESCE(?, balance), 
                           click_lvl=COALESCE(?, click_lvl), 
                           energy=COALESCE(?, energy), 
                           max_energy=COALESCE(?, max_energy), 
                           pnl=COALESCE(?, pnl), 
                           level=COALESCE(?, level), 
                           exp=COALESCE(?, exp), 
                           last_active=? WHERE id=?""",
                        (d.get('score'), d.get('click_lvl'), d.get('energy'), d.get('max_energy'),
                         d.get('pnl'), d.get('level'), d.get('exp'), int(time.time()), uid)
                    )
                await db_conn.commit()
                log_step("DB_SYNC", "Данные успешно сброшены на диск ✅")
        except Exception as e:
            log_step("LOOP_ERR", f"Сбой цикла обслуживания: {e}", C["R"])

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("DB_START", "Инициализация SQLite...")
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute('''CREATE TABLE IF NOT EXISTS users 
        (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
         energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
         level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)''')
    await db_conn.commit()
    
    try:
        log_step("SYSTEM", "Переустановка вебхука...")
        await bot.delete_webhook(drop_pending_updates=True)
        await asyncio.sleep(1)
        await bot.set_webhook(
            url=f"{WEBHOOK_URL}/", 
            allowed_updates=["message", "callback_query", "web_app_data"],
            drop_pending_updates=True
        )
        log_step("WEBHOOK", "Вебхук успешно установлен")
    except Exception as e:
        log_step("TG_CRITICAL", f"Ошибка вебхука: {e}", C["R"])
    
    m_task = asyncio.create_task(maintenance_loop())
    yield
    m_task.cancel()
    await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API ЭНДПОИНТЫ] ---

@app.get("/api/leaderboard")
async def get_leaderboard():
    log_step("API_DB", "Запрос таблицы лидеров (ТОП-10)")
    try:
        # Принудительно сбрасываем кеш в БД перед чтением топа (опционально, для точности)
        db_conn.row_factory = aiosqlite.Row
        async with db_conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as cursor:
            rows = await cursor.fetchall()
            
        leaderboard = [{"id": r["id"], "balance": r["balance"]} for r in rows]
        log_step("API_DB", f"Топ сформирован: {len(leaderboard)} записей")
        return {"status": "ok", "data": leaderboard}
    except Exception as e:
        log_step("DB_ERR", f"Ошибка лидерборда: {e}", C["R"])
        return {"status": "error", "message": str(e)}

@app.post("/api/save")
async def save_game(data: SaveData):
    log_step("API_SAVE", f"Данные от {data.user_id} приняты в кеш")
    uid = data.user_id
    new_payload = data.model_dump(exclude_unset=True)
    if uid not in USER_CACHE:
        USER_CACHE[uid] = {"data": {}, "last_save": time.time()}
    USER_CACHE[uid]["data"].update(new_payload)
    return {"status": "ok"}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    log_step("API_GET", f"Запрос баланса: {user_id}")
    if user_id in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[user_id]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        user = await cursor.fetchone()
        
    if not user:
        log_step("API_GET", f"Новый игрок: {user_id}", C["Y"])
        new_data = {"score": 1000, "click_lvl": 1, "energy": 1000, "max_energy": 1000, "pnl": 0, "level": 1, "exp": 0}
        await db_conn.execute("INSERT INTO users (id, balance) VALUES (?, ?)", (user_id, 1000))
        await db_conn.commit()
        USER_CACHE[user_id] = {"data": new_data, "last_save": time.time()}
        return {"status": "ok", "data": new_data}
        
    u_dict = dict(user)
    u_dict["score"] = u_dict.pop("balance") # Маппим баланс в score для фронтенда
    USER_CACHE[user_id] = {"data": u_dict, "last_save": time.time()}
    return {"status": "ok", "data": u_dict}

@app.post("/webhook/")
@app.post("/webhook")
async def telegram_webhook(request: Request):
    try:
        body = await request.body()
        data = json.loads(body)
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"status": "ok"}
    except Exception as e:
        log_step("TG_ERR", f"Ошибка вебхука: {e}", C["R"])
        return JSONResponse(content={"status": "error"}, status_code=500)

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

# Монтируем статику в конце
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    log_step("SYSTEM", "Запуск Uvicorn на порту 3000...")
    uvicorn.run("main:app", host="0.0.0.0", port=3000, proxy_headers=True, forwarded_allow_ips="*")
