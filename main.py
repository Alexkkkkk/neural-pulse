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

# --- КОНФИГУРАЦИЯ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
ADMIN_ID = "476014374"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NeuralPulse")

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- МОДЕЛИ ДАННЫХ ---
class SaveData(BaseModel):
    user_id: str
    score: int
    click_lvl: int = 1
    energy: int = 1000

    @field_validator('score', 'click_lvl', 'energy', mode='before')
    @classmethod
    def validate_to_int(cls, v):
        try: return int(float(v))
        except: return v

class UpgradeRequest(BaseModel):
    user_id: str
    cost: int
    new_lvl: int

    @field_validator('cost', 'new_lvl', mode='before')
    @classmethod
    def validate_to_int(cls, v):
        try: return int(float(v))
        except: return v

class WalletRequest(BaseModel):
    user_id: str
    wallet_address: str

# --- БАЗА ДАННЫХ ---
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, 
             balance INTEGER DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, 
             energy INTEGER DEFAULT 1000,
             last_active INTEGER DEFAULT 0,
             wallet TEXT)''')
        await db.commit()
    logger.info("📂 [DB] База данных синхронизирована")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 [SYSTEM] Старт приложения...")
    STATIC_DIR.mkdir(exist_ok=True)
    (STATIC_DIR / "images").mkdir(exist_ok=True)
    await init_db()
    await bot.delete_webhook(drop_pending_updates=True)
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, allowed_updates=["message", "callback_query"])
    logger.info(f"✅ [WEBHOOK] Активен: {webhook_url}")
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API ЭНДПОИНТЫ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
                user = await cursor.fetchone()
            if not user:
                now = int(time.time())
                await db.execute("INSERT INTO users (id, balance, click_lvl, energy, last_active) VALUES (?, ?, ?, ?, ?)", 
                                 (user_id, 1000, 1, 1000, now))
                await db.commit()
                return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "energy": 1000, "wallet": None}}
            return {"status": "ok", "data": dict(user)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error"})

@app.post("/api/save")
async def save_game(data: SaveData):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE users SET balance=?, click_lvl=?, energy=?, last_active=? WHERE id=?", 
                         (data.score, data.click_lvl, data.energy, int(time.time()), data.user_id))
        await db.commit()
    return {"status": "ok"}

@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"ok": True}
    except: return {"ok": False}

# --- ТЕЛЕГРАМ БОТ ---
@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="⚡ ВОЙТИ В СИСТЕМУ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>Neural Pulse Terminal</b>\n\nОбнаружен: <code>{m.from_user.first_name}</code>", reply_markup=kb)

# --- СТАТИКА (ИСПРАВЛЕННЫЙ БЛОК) ---

# 1. Сначала монтируем папку с картинками, чтобы /images/ файл.png работал
if (STATIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images")

# 2. Монтируем общую статику (CSS/JS)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# 3. Главная страница (самый важный эндпоинт)
@app.get("/")
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path, media_type='text/html')
    return JSONResponse(status_code=404, content={"error": f"index.html not found at {index_path}"})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=False)
