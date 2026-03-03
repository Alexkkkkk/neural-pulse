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
# Ставим статику в корень, если папки static нет
STATIC_DIR = BASE_DIR / "static" if (BASE_DIR / "static").exists() else BASE_DIR

logging.basicConfig(level=logging.INFO)
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- СХЕМЫ ДАННЫХ ---
class SaveData(BaseModel):
    user_id: str
    score: float   
    click_lvl: int
    energy: float  
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
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000,
             pnl INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0,
             wallet TEXT, referrer_id TEXT, referrals_count INTEGER DEFAULT 0)''')
        await db.commit()
    logging.info("Database initialized.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    logging.info(f"Webhook set to {webhook_url}")
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# --- API ENDPOINTS ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            await db.execute("INSERT INTO users (id, balance, last_active, energy) VALUES (?, ?, ?, ?)", 
                             (user_id, 1000.0, now, 1000.0))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "energy": 1000, "pnl": 0}}

        u = dict(user)
        # Расчет пассивного дохода при входе
        if u['pnl'] > 0 and u['last_active'] > 0:
            diff = now - u['last_active']
            # Лимит накопления - 8 часов (28800 сек)
            earned = (min(diff, 28800) / 3600) * u['pnl']
            if earned > 0:
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", 
                                 (u['balance'], now, user_id))
                await db.commit()
        
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    async with aiosqlite.connect(DB_PATH) as db:
        # Используем REAL (float) в БД для точности дробного PNL
        await db.execute("UPDATE users SET balance=?, click_lvl=?, energy=?, pnl=?, last_active=? WHERE id=?", 
                         (data.score, data.click_lvl, data.energy, data.pnl, int(time.time()), data.user_id))
        await db.commit()
    return {"status": "ok"}

@app.post("/api/upgrade")
async def upgrade_tap(data: UpgradeData):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT balance FROM users WHERE id = ?", (data.user_id,)) as cursor:
            row = await cursor.fetchone()
            if not row or row[0] < data.cost:
                return {"status": "error", "message": "Low balance"}

        await db.execute(
            "UPDATE users SET balance = balance - ?, click_lvl = ? WHERE id = ?",
            (data.cost, data.new_lvl, data.user_id)
        )
        await db.commit()
        
        async with db.execute("SELECT balance FROM users WHERE id = ?", (data.user_id,)) as cursor:
            new_row = await cursor.fetchone()
            return {"status": "ok", "new_balance": new_row[0]}

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

# --- BOT LOGIC ---

@dp.message(Command("start"))
async def cmd_start(m: types.Message, command: CommandObject):
    user_id = str(m.from_user.id)
    args = command.args 
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id = ?", (user_id,)) as cursor:
            exists = await cursor.fetchone()
        
        if not exists:
            ref_id = args if args and args != user_id else None
            await db.execute("INSERT INTO users (id, balance, referrer_id, last_active, energy) VALUES (?, ?, ?, ?, ?)", 
                             (user_id, 1000.0, ref_id, int(time.time()), 1000.0))
            
            if ref_id:
                await db.execute("UPDATE users SET balance = balance + 50000, referrals_count = referrals_count + 1 WHERE id = ?", (ref_id,))
                try:
                    await bot.send_message(ref_id, f"<b>🎉 Новый реферал!</b>\nВам начислено 50,000 NP.")
                except: pass
            await db.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))],
        [InlineKeyboardButton(text="🔗 ПРИГЛАСИТЬ ДРУГА", switch_inline_query=f"https://t.me/neural_pulse_bot?start={user_id}")]
    ])
    await m.answer(f"<b>Система Neural Pulse активна.</b>\nВаш ID: <code>{user_id}</code>\nПриглашайте друзей и зарабатывайте!", reply_markup=kb)

# --- WEBHOOK & STATIC ---

@app.post("/webhook")
async def bot_webhook(request: Request):
    update_data = await request.json()
    update = Update.model_validate(update_data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@app.get("/")
async def index():
    # Проверяем файл в корне или в static
    paths = [BASE_DIR / "index.html", BASE_DIR / "static" / "index.html"]
    for p in paths:
        if p.exists():
            return FileResponse(p)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

# Монтируем статику только если папки существуют
if (BASE_DIR / "static").exists():
    app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
