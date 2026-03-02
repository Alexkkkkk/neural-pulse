import os, sys, asyncio, sqlite3, uvicorn, logging, time
import aiosqlite
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, field_validator
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.utils.deep_linking import create_start_link

# --- КОНФИГУРАЦИЯ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
ADMIN_ID = "476014374"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("NeuralPulse")

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- МОДЕЛИ ДАННЫХ (Защита от 422) ---
class SaveData(BaseModel):
    user_id: str
    score: int = 0
    click_lvl: int = 1
    energy: int = 1000
    pnl: int = 0  # Прибыль в час

    @field_validator('user_id', mode='before')
    def force_str(cls, v): return str(v)

    @field_validator('score', 'click_lvl', 'energy', 'pnl', mode='before')
    def to_int(cls, v):
        try: return int(float(v))
        except: return 0

# --- БАЗА ДАННЫХ ---
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, energy INTEGER DEFAULT 1000,
             pnl INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0,
             referrer TEXT, wallet TEXT)''')
        await db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await bot.delete_webhook(drop_pending_updates=True)
    await bot.set_webhook(url=f"https://{MY_DOMAIN}/webhook")
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ЭНДПОИНТЫ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            user = await cursor.fetchone()
        
        if not user:
            now = int(time.time())
            await db.execute("INSERT INTO users (id, balance, last_active) VALUES (?, ?, ?)", (user_id, 1000, now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "energy": 1000, "pnl": 0}}

        # Расчет пассивного дохода (Mining)
        u = dict(user)
        now = int(time.time())
        if u['pnl'] > 0 and u['last_active'] > 0:
            seconds_passed = now - u['last_active']
            # Максимум 3 часа оффлайна (10800 сек)
            earned = int((min(seconds_passed, 10800) / 3600) * u['pnl'])
            if earned > 0:
                u['balance'] += earned
                await db.execute("UPDATE users SET balance = ?, last_active = ? WHERE id = ?", (u['balance'], now, user_id))
                await db.commit()
        
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""UPDATE users SET balance=?, click_lvl=?, energy=?, pnl=?, last_active=? WHERE id=?""", 
                         (data.score, data.click_lvl, data.energy, data.pnl, int(time.time()), data.user_id))
        await db.commit()
    return {"status": "ok"}

@app.post("/webhook")
async def bot_webhook(request: Request):
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

# --- ТЕЛЕГРАМ БОТ (Рефералка) ---
@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    user_id = str(m.from_user.id)
    ref_id = m.text.split()[1] if len(m.text.split()) > 1 else None
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id = ?", (user_id,)) as cursor:
            if not await cursor.fetchone():
                # Новый игрок по рефке
                await db.execute("INSERT INTO users (id, balance, referrer, last_active) VALUES (?, ?, ?, ?)", 
                                 (user_id, 1000, ref_id, int(time.time())))
                if ref_id:
                    await db.execute("UPDATE users SET balance = balance + 50000 WHERE id = ?", (ref_id,))
                    try: await bot.send_message(ref_id, "💎 <b>+50,000 NP</b> за приглашение друга!")
                    except: pass
                await db.commit()

    link = f"https://{MY_DOMAIN}/"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ВХОД В ТЕРМИНАЛ", web_app=WebAppInfo(url=link))],
        [InlineKeyboardButton(text="📢 КАНАЛ", url="https://t.me/your_channel")]
    ])
    await m.answer(f"<b>Neural Pulse Terminal</b>\nСистема готова к работе.", reply_markup=kb)

# --- СТАТИКА ---
@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")

if (STATIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000)
