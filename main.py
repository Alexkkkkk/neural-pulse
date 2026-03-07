import os, asyncio, logging, time, sys
import aiosqlite, uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command, CommandObject
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [SETUP] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"
WEB_APP_URL = "https://np.bothost.ru" 
ADMIN_ID = 476014374 

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
logger = logging.getLogger("NP_PRO_ULTRA")

USER_CACHE = {}
LAST_SAVE = {}
db_conn = None

# --- [DB WORKER - HIGHLOAD READY] ---
async def db_syncer():
    """Сбрасывает кэш в базу каждые 15 секунд (Оптимизация под 20млн юзеров)"""
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        try:
            to_save = []
            keys = list(USER_CACHE.keys())
            for uid in keys:
                entry = USER_CACHE.pop(uid, None)
                if not entry: continue
                d = entry.get("data")
                if not d: continue
                # Собираем данные: баланс, уровень клика, пассивный доход, энергия, макс энергия, лвл
                to_save.append((
                    str(uid), 
                    float(d.get('score', 0)), 
                    int(d.get('tap_power', 1)), 
                    float(d.get('pnl', 0)),
                    float(d.get('energy', 0)), 
                    int(d.get('max_energy', 1000)),
                    int(d.get('level', 1)),
                    int(time.time())
                ))
            
            if to_save:
                async with db_conn.execute("BEGIN TRANSACTION"):
                    await db_conn.executemany("""
                        INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active)
                        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance, click_lvl=excluded.click_lvl, pnl=excluded.pnl,
                        energy=excluded.energy, level=excluded.level, last_active=excluded.last_active
                    """, to_save)
                await db_conn.commit()
                logger.info(f"💾 Highload Sync: {len(to_save)} юзеров сохранено")
        except Exception as e: logger.error(f"DB Error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL") # Режим параллельного чтения/записи
    # Расширенная таблица для крутого функционала
    await db_conn.execute("""CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
        pnl REAL DEFAULT 0, energy REAL, max_energy INTEGER, 
        level INTEGER DEFAULT 1, last_active INTEGER)""")
    await db_conn.commit()
    
    asyncio.create_task(db_syncer())
    
    bot = Bot(token=API_TOKEN)
    dp = Dispatcher()
    
    @dp.message(Command("start"))
    async def start(m: types.Message, command: CommandObject):
        uid = str(m.from_user.id)
        ref_id = command.args # Получаем ID пригласившего
        
        # Реферальная логика
        if ref_id and ref_id != uid:
            async with db_conn.execute("SELECT id FROM users WHERE id=?", (ref_id,)) as cur:
                if await cur.fetchone():
                    await db_conn.execute("UPDATE users SET balance = balance + 25000 WHERE id=?", (ref_id,))
                    await db_conn.commit()
                    try: await bot.send_message(ref_id, "🎁 Друг зашел по твоей ссылке! Тебе начислено 25,000 NP!")
                    except: pass

        game_url = f"{WEB_APP_URL}/?v={int(time.time())}"
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="ИГРАТЬ В NEURAL PULSE 🧠", web_app=WebAppInfo(url=game_url))],
            [InlineKeyboardButton(text="КАНАЛ ПРОЕКТА 📢", url="https://t.me/neural_pulse")]
        ])
        
        await m.answer(
            f"🚀 <b>Neural Pulse: Эволюция ИИ</b>\n\n"
            f"Ты — оператор нейросети нового поколения. Добывай токены, прокачивай модули и стань лидером мирового рейтинга.\n\n"
            f"🎁 <b>Бонус:</b> Приглашай друзей и получай 25,000 NP!", 
            reply_markup=kb, parse_mode="HTML"
        )

    asyncio.create_task(dp.start_polling(bot))
    yield
    await db_conn.close()

app = FastAPI(lifespan=lifespan)

# --- [API] ---
@app.get("/api/balance/{user_id}")
async def get_bal(user_id: str):
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id=?", (user_id,)) as cur:
        row = await cur.fetchone()
    
    now = int(time.time())
    if row:
        data = dict(row)
        # Магия пассивного дохода: считаем сколько накапало за время отсутствия
        off_time = now - data['last_active']
        off_time = min(off_time, 10800) # Максимум 3 часа (как в Хамстере)
        earned = (data['pnl'] / 3600) * off_time
        
        return {"status": "ok", "data": {
            "score": data["balance"] + earned,
            "tap_power": data["click_lvl"],
            "pnl": data["pnl"],
            "energy": data["energy"],
            "max_energy": data["max_energy"],
            "level": data["level"]
        }}
    
    # Регистрация нового гиганта
    await db_conn.execute("INSERT INTO users VALUES (?,5000,1,0,1000,1000,1,?)", (user_id, now))
    await db_conn.commit()
    return {"status": "ok", "data": {"score": 5000, "tap_power": 1, "pnl": 0, "energy": 1000, "max_energy": 1000, "level": 1}}

@app.post("/api/save")
async def save(request: Request):
    try:
        data = await request.json()
        uid = str(data.get("user_id"))
        if not uid or uid == "None": return {"status": "error"}
        
        # Троттлинг (сохраняем не чаще чем раз в 2 сек)
        now = time.time()
        if now - LAST_SAVE.get(uid, 0) < 2: return {"status": "throttled"}
            
        LAST_SAVE[uid] = now
        USER_CACHE[uid] = {"data": data}
        return {"status": "ok"}
    except:
        return {"status": "error"}

@app.get("/")
async def index(): return FileResponse(STATIC_DIR / "index.html")
app.mount("/", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=False)
