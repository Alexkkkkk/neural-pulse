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
    score: Optional[float] = 0.0
    click_lvl: Optional[int] = 1
    energy: Optional[float] = 1000.0
    pnl: Optional[float] = 0.0

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
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    logger.info(f"Webhook set to {webhook_url}")
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
        
        return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET balance=?, click_lvl=?, energy=?, pnl=?, last_active=? WHERE id=?", 
            (data.score, data.click_lvl, data.energy, data.pnl, int(time.time()), data.user_id)
        )
        await db.commit()
    return {"status": "ok"}

# --- BOT HANDLERS ---
@dp.message(Command("start"))
async def cmd_start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚀 ЗАПУСТИТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))]
    ])
    await m.answer("<b>Neural Pulse Terminal v1.0</b>\nСистема готова к работе.", reply_markup=kb)

@app.post("/webhook")
async def bot_webhook(request: Request):
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

# --- ФИНАЛЬНЫЙ ПОИСК ФРОНТЕНДА ---
@app.get("/")
async def index():
    search_paths = [
        BASE_DIR / "index.html",
        BASE_DIR / "static" / "index.html",
        Path("/app/index.html"),
        Path.cwd() / "index.html"
    ]
    
    for path in search_paths:
        if path.exists():
            logger.info(f"✅ Found index.html at: {path}")
            return FileResponse(path)

    # Список всех файлов для отладки
    try:
        all_files = [str(p) for p in Path(BASE_DIR).rglob('*') if p.is_file()][:20]
    except:
        all_files = ["Could not list files"]
        
    logger.error(f"❌ index.html NOT FOUND. Project root: {BASE_DIR}. Files: {all_files}")
    return JSONResponse({"error": "File not found", "files_on_server": all_files}, status_code=404)

# Монтируем статику
for folder in ["static", "images"]:
    path = BASE_DIR / folder
    if path.exists():
        app.mount(f"/{folder}", StaticFiles(directory=str(path)), name=folder)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
