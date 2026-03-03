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
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandObject, Command

# --- CONFIG ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- SCHEMAS ---
class SaveData(BaseModel):
    model_config = ConfigDict(extra="allow")
    user_id: str
    score: float
    click_lvl: int
    energy: float
    pnl: float

class UpgradeData(BaseModel):
    user_id: str
    cost: float
    new_lvl: int

class WalletData(BaseModel):
    user_id: str
    wallet_address: str

# --- DATABASE ---
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000,
             pnl REAL DEFAULT 0, last_active INTEGER DEFAULT 0,
             wallet TEXT, referrer_id TEXT, referrals_count INTEGER DEFAULT 0)''')
        await db.commit()
    logger.info("Database initialized.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await bot.set_webhook(url=f"https://{MY_DOMAIN}/webhook", drop_pending_updates=True)
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ---

@app.get("/favicon.ico", include_in_schema=False)
async def favicon(): return JSONResponse({})

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            await db.execute("INSERT INTO users (id, balance, last_active, energy) VALUES (?, 1000, ?, 1000)", (user_id, now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "energy": 1000, "pnl": 0}}
        
        u = dict(user)
        # Начисление офлайн дохода
        if u['pnl'] > 0 and u['last_active'] > 0:
            earned = (min(now - u['last_active'], 28800) / 3600) * u['pnl']
            if earned > 0:
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", (u['balance'], now, user_id))
                await db.commit()
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET balance=?, click_lvl=?, energy=?, pnl=?, last_active=? WHERE id=?", 
            (data.score, data.click_lvl, data.energy, data.pnl, int(time.time()), data.user_id)
        )
        await db.commit()
    return {"status": "ok"}

@app.post("/api/upgrade")
async def upgrade(data: UpgradeData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE users SET balance = balance - ?, click_lvl = ? WHERE id = ?", 
                         (data.cost, data.new_lvl, data.user_id))
        await db.commit()
    return {"status": "ok"}

@app.post("/api/save_wallet")
async def save_wallet(data: WalletData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE users SET wallet = ? WHERE id = ?", (data.wallet_address, data.user_id))
        await db.commit()
    return {"status": "ok"}

@app.get("/api/leaderboard")
async def leaderboard():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as c:
            rows = await c.fetchall()
            return {"status": "ok", "data": [dict(r) for r in rows]}

# --- BOT ---
@dp.message(Command("start"))
async def cmd_start(m: types.Message, command: CommandObject):
    user_id = str(m.from_user.id)
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id=?", (user_id,)) as c:
            if not await c.fetchone():
                ref = command.args if command.args and command.args != user_id else None
                await db.execute("INSERT INTO users (id, balance, referrer_id, last_active) VALUES (?, 1000, ?, ?)", 
                                 (user_id, ref, int(time.time())))
                if ref: 
                    await db.execute("UPDATE users SET balance=balance+50000 WHERE id=?", (ref,))
                await db.commit()
    
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚀 ЗАПУСТИТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))]
    ])
    await m.answer("<b>Neural Pulse Terminal v1.0</b>\nСистема готова к работе.", reply_markup=kb)

@app.post("/webhook")
async def bot_webhook(request: Request):
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@app.get("/")
async def index(): return FileResponse(BASE_DIR / "index.html")

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
