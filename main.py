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

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
        # Используем REAL для баланса и энергии, чтобы избежать конфликтов типов
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000,
             pnl INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0,
             wallet TEXT, referrer_id TEXT, referrals_count INTEGER DEFAULT 0)''')
        await db.commit()
    logger.info("Database initialized with REAL types.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    logger.info(f"Webhook set to {webhook_url}")
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

# Разрешаем CORS для связи фронтенда и бэкенда
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
            # Создаем нового пользователя, если его нет
            await db.execute("INSERT INTO users (id, balance, last_active, energy) VALUES (?, ?, ?, ?)", 
                             (user_id, 1000.0, now, 1000.0))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "energy": 1000, "pnl": 0}}

        u = dict(user)
        # Начисление пассивного дохода (PNL)
        if u['pnl'] > 0 and u['last_active'] > 0:
            diff = now - u['last_active']
            # Лимит пассивного дохода — 8 часов
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
        await db.execute(
            "UPDATE users SET balance=?, click_lvl=?, energy=?, pnl=?, last_active=? WHERE id=?", 
            (data.score, data.click_lvl, data.energy, data.pnl, int(time.time()), data.user_id)
        )
        await db.commit()
    return {"status": "ok"}

@app.post("/api/upgrade")
async def upgrade_tap(data: UpgradeData):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT balance FROM users WHERE id = ?", (data.user_id,)) as cursor:
            row = await cursor.fetchone()
            if not row or row[0] < data.cost:
                return {"status": "error", "message": "Insufficient funds"}

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
            await db.execute(
                "INSERT INTO users (id, balance, referrer_id, last_active, energy) VALUES (?, ?, ?, ?, ?)", 
                (user_id, 1000.0, ref_id, int(time.time()), 1000.0)
            )
            
            if ref_id:
                # Бонус рефереру
                await db.execute(
                    "UPDATE users SET balance = balance + 50000, referrals_count = referrals_count + 1 WHERE id = ?", 
                    (ref_id,)
                )
                try:
                    await bot.send_message(ref_id, "<b>🎉 У вас новый реферал!</b>\nНачислено 50,000 NP.")
                except: pass
            await db.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))],
        [InlineKeyboardButton(text="🔗 ПРИГЛАСИТЬ ДРУГА", switch_inline_query=f"Присоединяйся к Neural Pulse! Мой ID: {user_id}")]
    ])
    await m.answer(f"<b>Система Neural Pulse активна.</b>\nВаш ID: <code>{user_id}</code>\n\nДобро пожаловать в сеть.", reply_markup=kb)

# --- WEBHOOK & STATIC ---

@app.post("/webhook")
async def bot_webhook(request: Request):
    update_data = await request.json()
    update = Update.model_validate(update_data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@app.get("/")
async def index():
    # Поиск index.html в корне или папке static
    for p in [BASE_DIR / "index.html", BASE_DIR / "static" / "index.html"]:
        if p.exists():
            return FileResponse(p)
    return JSONResponse({"error": "index.html not found. Check your file location."}, status_code=404)

# Монтирование папок со статикой (картинки, стили)
if (BASE_DIR / "static").exists():
    app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
if (BASE_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(BASE_DIR / "images")), name="images")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
