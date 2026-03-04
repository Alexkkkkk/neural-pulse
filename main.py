import os, asyncio, logging, time, datetime, sys, json, traceback, shutil
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
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

# --- [НАСТРОЙКИ ПУТЕЙ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = STATIC_DIR / "images"

# ID Администратора
ADMIN_ID = 476014374 

for folder in [STATIC_DIR, IMAGES_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

# Токен
API_TOKEN = "8257287930:AAGMADWoM4PUoZu8OhmnOOtKyaDlTLRWUn4" 

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

# --- [АДМИН-ПАНЕЛЬ] ---
def get_admin_kb():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📊 Статус", callback_data="adm_status"),
         InlineKeyboardButton(text="🧹 Кэш", callback_data="adm_clear")],
        [InlineKeyboardButton(text="🔄 Рестарт", callback_data="adm_reboot"),
         InlineKeyboardButton(text="⛔ Стоп", callback_data="adm_stop")]
    ])

@dp.message(F.text == "/admin")
async def admin_cmd(message: types.Message):
    if message.from_user.id != ADMIN_ID: return
    await message.answer("<b>⚡ NEURAL PULSE ADMIN</b>\nВыбери действие:", 
                         parse_mode="HTML", reply_markup=get_admin_kb())

@dp.callback_query(F.data.startswith("adm_"))
async def admin_calls(call: types.CallbackQuery):
    if call.from_user.id != ADMIN_ID: 
        await call.answer("Доступ запрещен", show_alert=True)
        return
    action = call.data.split("_")[1]
    if action == "status":
        process = psutil.Process(os.getpid())
        mem = process.memory_info().rss / 1024 / 1024
        db_size = os.path.getsize(DB_PATH) / 1024 if DB_PATH.exists() else 0
        txt = (f"<b>Статус:</b> Online ✅\n"
               f"<b>RAM:</b> {mem:.1f} MB\n"
               f"<b>DB:</b> {db_size:.1f} KB\n"
               f"<b>В кэше:</b> {len(USER_CACHE)} чел.")
        await call.message.edit_text(txt, parse_mode="HTML", reply_markup=get_admin_kb())
    elif action == "reboot":
        await call.message.edit_text("🔄 Рестарт системы...")
        log_step("SYSTEM", "Рестарт по команде админа", C["R"])
        os.execv(sys.executable, ['python'] + sys.argv)
    elif action == "stop":
        await call.message.edit_text("⛔ Остановка...")
        sys.exit()

# --- [ОБЫЧНЫЕ КОМАНДЫ] ---
@dp.message(F.text == "/start")
async def start_cmd(message: types.Message):
    log_step("TG_MSG", f"Start received from {message.from_user.id}")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=types.WebAppInfo(url="https://np.bothost.ru/"))]
    ])
    await message.answer(f"Привет, {message.from_user.first_name}! Твоя нейросеть готова к работе.\nЖми кнопку ниже!", reply_markup=kb)

# --- [ФОНОВЫЕ ЗАДАЧИ] ---
async def maintenance_loop():
    log_step("SYSTEM", "Цикл синхронизации активен (60с)", C["C"])
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
                log_step("DB_SAVE", f"Синхронизировано игроков: {len(USER_CACHE)}", C["P"])
        except Exception as e:
            log_step("DB_ERR", f"Ошибка БД: {e}", C["R"])

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("STARTUP", ">>> Инициализация сервера <<<", C["B"])
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)")
    await db_conn.commit()
    
    # Сброс вебхука и запуск поллинга
    await bot.delete_webhook(drop_pending_updates=True)
    polling_task = asyncio.create_task(dp.start_polling(bot))
    sync_task = asyncio.create_task(maintenance_loop())
    
    log_step("SYSTEM", "Бот и задачи запущены успешно", C["G"])
    yield
    # Завершение
    polling_task.cancel()
    sync_task.cancel()
    await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API ЭНДПОИНТЫ] ---
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    if uid in USER_CACHE: return {"status": "ok", "data": USER_CACHE[uid]["data"]}
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
    if uid not in USER_CACHE: USER_CACHE[uid] = {"data": {}}
    USER_CACHE[uid]["data"].update(data.model_dump(exclude_unset=True))
    return {"status": "ok"}

@app.get("/api/leaderboard")
async def get_leaderboard():
    log_step("API_REQ", "Запрос лидерборда", C["Y"])
    try:
        db_conn.row_factory = aiosqlite.Row
        async with db_conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as cursor:
            rows = await cursor.fetchall()
            data = [dict(r) for r in rows]
            return {"status": "ok", "data": data}
    except Exception as e:
        log_step("API_ERR", f"Ошибка лидерборда: {e}", C["R"])
        return {"status": "error", "message": str(e)}

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, proxy_headers=True, forwarded_allow_ips="*")
