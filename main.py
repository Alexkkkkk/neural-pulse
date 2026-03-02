import os, sys, asyncio, logging, time
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
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
STATIC_DIR = BASE_DIR / "static"

logging.basicConfig(level=logging.INFO)
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- СХЕМЫ ДАННЫХ ---
class SaveData(BaseModel):
    user_id: str
    score: int
    click_lvl: int
    energy: int
    pnl: int = 0

class UpgradeData(BaseModel):
    user_id: str
    cost: int
    new_lvl: int

class WalletData(BaseModel):
    user_id: str
    wallet_address: str

# --- БАЗА ДАННЫХ ---
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        # Добавляем новые колонки для рефералов
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, energy INTEGER DEFAULT 1000,
             pnl INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0,
             wallet TEXT, referrer_id TEXT, referrals_count INTEGER DEFAULT 0)''')
        await db.commit()
    logging.info("Database initialized with Referral System.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await bot.set_webhook(url=f"https://{MY_DOMAIN}/webhook")
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ENDPOINTS ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            await db.execute("INSERT INTO users (id, balance, last_active) VALUES (?, ?, ?)", (user_id, 1000, now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "energy": 1000, "pnl": 0}}

        u = dict(user)
        if u['pnl'] > 0 and u['last_active'] > 0:
            diff = now - u['last_active']
            earned = int((min(diff, 28800) / 3600) * u['pnl']) 
            if earned > 0:
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", (u['balance'], now, user_id))
                await db.commit()
        
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE users SET balance=?, click_lvl=?, energy=?, pnl=?, last_active=? WHERE id=?", 
                         (data.score, data.click_lvl, data.energy, data.pnl, int(time.time()), data.user_id))
        await db.commit()
    return {"status": "ok"}

@app.post("/api/upgrade")
async def upgrade_tap(data: UpgradeData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET balance = balance - ?, click_lvl = ? WHERE id = ? AND balance >= ?",
            (data.cost, data.new_lvl, data.user_id, data.cost)
        )
        await db.commit()
        async with db.execute("SELECT balance FROM users WHERE id = ?", (data.user_id,)) as cursor:
            row = await cursor.fetchone()
            return {"status": "ok", "new_balance": row[0] if row else 0}

@app.get("/api/leaderboard")
async def get_leaderboard():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as cursor:
            rows = await cursor.fetchall()
            return {"status": "ok", "data": [dict(r) for r in rows]}

@app.post("/api/save_wallet")
async def save_wallet(data: WalletData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE users SET wallet=? WHERE id=?", (data.wallet_address, data.user_id))
        await db.commit()
    return {"status": "ok"}

# --- ЛОГИКА БОТА И РЕФЕРАЛОВ ---

@dp.message(Command("start"))
async def cmd_start(m: types.Message, command: CommandObject):
    user_id = str(m.from_user.id)
    args = command.args  # ID пригласившего
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id = ?", (user_id,)) as cursor:
            exists = await cursor.fetchone()
        
        if not exists:
            ref_id = args if args and args != user_id else None
            await db.execute("INSERT INTO users (id, balance, referrer_id, last_active) VALUES (?, ?, ?, ?)", 
                             (user_id, 1000, ref_id, int(time.time())))
            
            if ref_id:
                # Бонус пригласившему (50,000 NP)
                await db.execute("UPDATE users SET balance = balance + 50000, referrals_count = referrals_count + 1 WHERE id = ?", (ref_id,))
                try:
                    await bot.send_message(ref_id, f"<b>🎉 Новый реферал!</b>\nВам начислено 50,000 NP.")
                except: pass
            await db.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))],
        [InlineKeyboardButton(text="🔗 ПРИГЛАСИТЬ ДРУГА", switch_inline_query=f"\nПрисоединяйся к Neural Pulse! Моя ссылка: https://t.me/neural_pulse_bot?start={user_id}")]
    ])
    await m.answer(f"<b>Система Neural Pulse активна.</b>\nВаш ID: <code>{user_id}</code>\nПриглашайте друзей и получайте бонусы!", reply_markup=kb)

# --- WEBHOOK & STATIC ---

@app.post("/webhook")
async def bot_webhook(request: Request):
    update_data = await request.json()
    update = Update.model_validate(update_data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
