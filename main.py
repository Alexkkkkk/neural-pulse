import os, sys, asyncio, logging, time
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

# --- CONFIG ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: str
    score: int
    click_lvl: int
    energy: int
    pnl: int = 0 # Profit per hour

    @field_validator('user_id', mode='before')
    def to_str(cls, v): return str(v)

    @field_validator('score', 'click_lvl', 'energy', 'pnl', mode='before')
    def to_int(cls, v):
        try: return int(float(v))
        except: return 0

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, energy INTEGER DEFAULT 1000,
             pnl INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)''')
        await db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await bot.set_webhook(url=f"https://{MY_DOMAIN}/webhook")
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

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
        # Расчет пассивного дохода за время отсутствия
        if u['pnl'] > 0 and u['last_active'] > 0:
            diff = now - u['last_active']
            earned = int((min(diff, 28800) / 3600) * u['pnl']) # Макс 8 часов оффлайна
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

@app.post("/webhook")
async def bot_webhook(request: Request):
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

@dp.message(F.text == "/start")
async def cmd_start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer("<b>Система Neural Pulse активирована.</b>\nДоступ к терминалу разрешен.", reply_markup=kb)

# Статика
@app.get("/")
async def index(): return FileResponse(STATIC_DIR / "index.html")
app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000)
