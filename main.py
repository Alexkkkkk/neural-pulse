import os, sys, asyncio, sqlite3, uvicorn, logging, time
import aiosqlite
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

# --- КОНФИГУРАЦИЯ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
ADMIN_ID = "476014374" 
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"

INITIAL_BALANCE = 1000
MAX_ENERGY = 1000

# Настройка логирования
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

class UpgradeRequest(BaseModel):
    user_id: str
    cost: int
    new_lvl: int

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
                                 (user_id, INITIAL_BALANCE, 1, MAX_ENERGY, now))
                await db.commit()
                
                try:
                    await bot.send_message(ADMIN_ID, f"🆕 <b>Новый вход в WebApp!</b>\nID: <code>{user_id}</code>")
                except: pass
                
                return {"status": "ok", "data": {"balance": INITIAL_BALANCE, "click_lvl": 1, "energy": MAX_ENERGY, "wallet": None}}
            
            return {"status": "ok", "data": dict(user)}
    except Exception as e:
        logger.error(f"Error GET balance: {e}")
        return JSONResponse(status_code=500, content={"status": "error"})

@app.post("/api/save")
async def save_game(data: SaveData):
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("UPDATE users SET balance=?, click_lvl=?, energy=?, last_active=? WHERE id=?", 
                             (data.score, data.click_lvl, data.energy, int(time.time()), data.user_id))
            await db.commit()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error POST save: {e}")
        return JSONResponse(status_code=500, content={"status": "error"})

@app.post("/api/save_wallet")
async def save_wallet(data: WalletRequest):
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("UPDATE users SET wallet=? WHERE id=?", (data.wallet_address, data.user_id))
            await db.commit()
        return {"status": "ok"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error"})

@app.get("/api/leaderboard")
async def get_leaderboard():
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as cursor:
                rows = await cursor.fetchall()
                return {"status": "ok", "data": [dict(row) for row in rows]}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error"})

@app.post("/api/upgrade")
async def upgrade_click(data: UpgradeRequest):
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT balance FROM users WHERE id=?", (data.user_id,)) as cursor:
                row = await cursor.fetchone()
            
            if row and row[0] >= data.cost:
                new_balance = row[0] - data.cost
                await db.execute("UPDATE users SET balance = ?, click_lvl = ? WHERE id = ?",
                                 (new_balance, data.new_lvl, data.user_id))
                await db.commit()
                return {"status": "ok", "new_balance": new_balance}
            return JSONResponse(status_code=400, content={"status": "error", "message": "Недостаточно NP"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error"})

@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        update_data = await request.json()
        update = Update.model_validate(update_data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return JSONResponse(status_code=400, content={"ok": False})

# --- ТЕЛЕГРАМ БОТ ---

@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    uid = str(m.from_user.id)
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id = ?", (uid,)) as cursor:
            if not await cursor.fetchone():
                await db.execute("INSERT INTO users (id, balance, click_lvl, energy, last_active) VALUES (?, ?, ?, ?, ?)", 
                                 (uid, INITIAL_BALANCE, 1, MAX_ENERGY, int(time.time())))
                await db.commit()
                try:
                    await bot.send_message(ADMIN_ID, f"🚀 <b>Новая регистрация в боте!</b>\nИмя: {m.from_user.full_name}\nID: <code>{uid}</code>")
                except: pass

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="⚡ ВОЙТИ В СИСТЕМУ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    
    await m.answer(
        f"<b>Neural Pulse Terminal v1.1.0</b>\n\nОбнаружен пользователь: <code>{m.from_user.first_name}</code>\n"
        f"ID доступа: <code>{uid}</code>\nСтатус: <b>Авторизован</b>", 
        reply_markup=kb
    )

# --- СТАТИЧЕСКИЕ ФАЙЛЫ ---

# 1. Монтируем изображения отдельно (если папка существует)
images_path = STATIC_DIR / "images"
if images_path.exists():
    app.mount("/images", StaticFiles(directory=str(images_path)), name="images")

# 2. Главная страница (должна быть перед общим монтированием статики)
@app.get("/")
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return JSONResponse(status_code=404, content={"error": "Frontend missing"})

# 3. Всё остальное из папки static
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=False)
