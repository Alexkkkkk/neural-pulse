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
STATIC_DIR = BASE_DIR / "static"
# Токен оставляем твой
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
        # Регистрируем с начальным балансом 1000
        await db_conn.execute("INSERT OR IGNORE INTO users (id, balance) VALUES (?, ?)", (uid, 1000.0))
        await db_conn.commit()
        log_step("DB_ACTION", f"Регистрация/Вход: {uid}", C["G"])

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Играть 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))],
        [InlineKeyboardButton(text="Канал проекта 📢", url="https://t.me/NeuralPulseCommunity")]
    ])
    await message.answer(
        f"<b>Добро пожаловать в Neural Pulse, {message.from_user.first_name}!</b>\n\nТвой нейронный узел готов к майнингу NP.",
        reply_markup=kb, parse_mode="HTML"
    )

# --- [ФОНОВЫЙ ЦИКЛ СОХРАНЕНИЯ] ---
async def maintenance_loop():
    log_step("SYSTEM", "Цикл синхронизации запущен", C["P"])
    while True:
        try:
            await asyncio.sleep(60) # Сохраняем раз в минуту
            if USER_CACHE and db_conn:
                uids = list(USER_CACHE.keys())
                count = 0
                for uid in uids:
                    data = USER_CACHE[uid].get("data")
                    if not data: continue
                    
                    await db_conn.execute(
                        """UPDATE users SET 
                           balance=?, click_lvl=?, energy=?, max_energy=?, 
                           pnl=?, level=?, exp=?, last_active=? 
                           WHERE id=?""",
                        (data.get('score'), data.get('click_lvl'), data.get('energy'), data.get('max_energy'),
                         data.get('pnl'), data.get('level'), data.get('exp'), int(time.time()), str(uid))
                    )
                    count += 1
                
                await db_conn.commit()
                if count > 0:
                    log_step("DB_SYNC", f"Данные {count} игроков сохранены", C["G"])
                    # Очищаем кэш после сохранения для экономии памяти (опционально)
                    # USER_CACHE.clear() 
        except Exception as e:
            log_step("LOOP_ERR", f"Ошибка синхронизации: {e}", C["R"])

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
        log_step("DB_READY", "База данных SQLite готова", C["G"])
        
        await bot.delete_webhook(drop_pending_updates=True)
        polling_task = asyncio.create_task(dp.start_polling(bot))
        sync_task = asyncio.create_task(maintenance_loop())
        
        yield
        
        polling_task.cancel()
        sync_task.cancel()
        await db_conn.close()
    except Exception as e:
        log_step("FATAL", f"Критический сбой: {e}", C["R"])

# --- [FASTAPI ПРИЛОЖЕНИЕ] ---
app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    # Если данные свежие в кэше - отдаем их
    if uid in USER_CACHE: 
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    if not db_conn: return JSONResponse({"status": "error", "msg": "DB offline"}, 500)

    try:
        db_conn.row_factory = aiosqlite.Row
        async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cursor:
            user = await cursor.fetchone()
        
        if not user:
            # Новый пользователь (если зашел через веб, а не через бота)
            initial_data = {"score": 1000.0, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "exp": 0}
            await db_conn.execute("INSERT OR IGNORE INTO users (id, balance) VALUES (?, ?)", (uid, 1000.0))
            await db_conn.commit()
            USER_CACHE[uid] = {"data": initial_data}
            return {"status": "ok", "data": initial_data}
        
        res = dict(user)
        # Маппинг имен: в БД 'balance', на фронте 'score'
        res["score"] = res.pop("balance") 
        USER_CACHE[uid] = {"data": res}
        return {"status": "ok", "data": res}
    except Exception as e:
        return JSONResponse({"status": "error", "msg": str(e)}, 500)

@app.post("/api/save")
async def save_game(data: SaveData):
    uid = str(data.user_id)
    if uid not in USER_CACHE: USER_CACHE[uid] = {"data": {}}
    
    # Обновляем кэш данными с фронтенда
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
    if p.exists(): return FileResponse(p)
    return JSONResponse({"err": "index.html не найден в папке static/"}, 404)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port, proxy_headers=True, forwarded_allow_ips="*")
