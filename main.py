import os, asyncio, logging, time
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandObject, Command

# --- CONFIG ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"

# Создание необходимых папок
for folder in ["static", "images"]:
    (BASE_DIR / folder).mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- SCHEMAS ---
class SaveData(BaseModel):
    model_config = ConfigDict(extra="allow")
    user_id: str
    score: Optional[float] = 0.0
    click_lvl: Optional[float] = 1.0
    energy: Optional[float] = 1000.0
    pnl: Optional[float] = 0.0

# --- DATABASE ---
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        # Включаем быстрый режим записи
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000,
             pnl REAL DEFAULT 0, last_active INTEGER DEFAULT 0,
             wallet TEXT, referrer_id TEXT, referrals_count INTEGER DEFAULT 0)''')
        await db.commit()
    logger.info("Database initialized with WAL mode.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    logger.info(f"Webhook set to {webhook_url}")
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ENDPOINTS ---

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return JSONResponse({})

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (str(user_id),)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            await db.execute("INSERT INTO users (id, balance, last_active, energy) VALUES (?, 1000.0, ?, 1000.0)", 
                             (str(user_id), now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "energy": 1000, "pnl": 0}}

        u = dict(user)
        # Начисление пассивного дохода
        if u['pnl'] > 0 and u['last_active'] > 0:
            diff = now - u['last_active']
            # Лимит 8 часов (28800 сек)
            earned = (min(diff, 28800) / 3600) * u['pnl']
            if earned > 0:
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", 
                                 (u['balance'], now, str(user_id)))
                await db.commit()
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE users SET balance=?, click_lvl=?, energy=?, pnl=?, last_active=? WHERE id=?", 
                (float(data.score or 0), int(data.click_lvl or 1), float(data.energy or 0), 
                 float(data.pnl or 0), int(time.time()), str(data.user_id))
            )
            await db.commit()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Save error: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.get("/api/leaderboard")
async def get_leaderboard():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as cursor:
            rows = await cursor.fetchall()
            return {"status": "ok", "data": [dict(r) for r in rows]}

# --- BOT LOGIC ---

@dp.message(Command("start"))
async def cmd_start(m: types.Message, command: CommandObject):
    user_id = str(m.from_user.id)
    args = command.args 
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id = ?", (user_id,)) as cursor:
            exists = await cursor.fetchone()
        
        if not exists:
            ref_id = str(args) if args and str(args) != user_id else None
            await db.execute(
                "INSERT INTO users (id, balance, referrer_id, last_active, energy) VALUES (?, 1000.0, ?, ?, 1000.0)", 
                (user_id, ref_id, int(time.time()))
            )
            if ref_id:
                # Проверяем, существует ли пригласитель
                async with db.execute("SELECT id FROM users WHERE id = ?", (ref_id,)) as c:
                    if await c.fetchone():
                        await db.execute("UPDATE users SET balance = balance + 50000, referrals_count = referrals_count + 1 WHERE id = ?", (ref_id,))
                        try: await bot.send_message(ref_id, "<b>🎉 Реферал!</b>\n+50,000 NP.")
                        except: pass
            await db.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))],
        [InlineKeyboardButton(text="🔗 ПРИГЛАСИТЬ", switch_inline_query=f"Играй со мной в Neural Pulse! https://t.me/neural_pulse_bot?start={user_id}")]
    ])
    await m.answer(f"<b>Neural Pulse Online.</b>\nID: <code>{user_id}</code>\n\nСистема готова.", reply_markup=kb)

# --- WEBHOOK & STATIC ---

@app.post("/webhook")
async def bot_webhook(request: Request):
    data = await request.json()
    update = Update.model_validate(data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@app.get("/")
async def index():
    for p in [BASE_DIR / "index.html", BASE_DIR / "static" / "index.html"]:
        if p.exists(): return FileResponse(p)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.mount("/images", StaticFiles(directory=str(BASE_DIR / "images")), name="images")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
