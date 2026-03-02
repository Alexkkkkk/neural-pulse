import os, sys, asyncio, sqlite3, uvicorn, logging, time
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

# --- НАСТРОЙКИ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = STATIC_DIR / "images"

STATIC_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)

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
    user_id: int
    score: int
    click_lvl: int = 1

class UpgradeRequest(BaseModel):
    user_id: int
    cost: int
    new_lvl: int

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 [SYSTEM] Запуск сервера...")
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS users 
                (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, 
                 click_lvl INTEGER DEFAULT 1, last_active INTEGER DEFAULT 0, wallet TEXT)''')
            conn.commit()
        logger.info("📂 [DB] База данных готова")
    except Exception as e:
        logger.error(f"❌ [DB ERROR]: {e}")

    await bot.delete_webhook(drop_pending_updates=True)
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url)
    logger.info(f"✅ [WEBHOOK] Установлен: {webhook_url}")
    
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ЭНДПОИНТЫ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    logger.info(f"📥 [API GET] Баланс ID: {user_id}")
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not user:
                conn.execute("INSERT INTO users (id, balance, click_lvl, last_active) VALUES (?, 1000, 1, ?)", 
                             (user_id, int(time.time())))
                conn.commit()
                return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1}}
            return {"status": "ok", "data": dict(user)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@app.post("/api/save")
async def save_game(data: SaveData):
    logger.info(f"📤 [API POST] Сохранение: ID={data.user_id}, Score={data.score}")
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("UPDATE users SET balance=?, click_lvl=?, last_active=? WHERE id=?", 
                         (data.score, data.click_lvl, int(time.time()), str(data.user_id)))
            conn.commit()
        return {"status": "ok"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error"})

# НОВАЯ ФУНКЦИЯ: Таблица лидеров
@app.get("/api/leaderboard")
async def get_leaderboard():
    logger.info("🏆 [API GET] Запрос таблицы лидеров")
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            # Получаем топ 10 игроков по балансу
            top_users = conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10").fetchall()
            return {"status": "ok", "data": [dict(row) for row in top_users]}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error"})

# НОВАЯ ФУНКЦИЯ: Покупка улучшения
@app.post("/api/upgrade")
async def upgrade_click(data: UpgradeRequest):
    logger.info(f"🛒 [UPGRADE] Попытка покупки: User {data.user_id}, Lvl {data.new_lvl}")
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            user = conn.execute("SELECT balance FROM users WHERE id=?", (str(data.user_id),)).fetchone()
            if user and user[0] >= data.cost:
                conn.execute("UPDATE users SET balance = balance - ?, click_lvl = ? WHERE id = ?",
                             (data.cost, data.new_lvl, str(data.user_id)))
                conn.commit()
                return {"status": "ok", "new_balance": user[0] - data.cost}
            return JSONResponse(status_code=400, content={"status": "error", "message": "Недостаточно средств"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error"})

@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        raw_data = await request.json()
        update = Update.model_validate(raw_data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False})

# --- ЛОГИКА БОТА ---

@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    logger.info(f"🤖 [START] User ID: {m.from_user.id}")
    with sqlite3.connect(str(DB_PATH)) as conn:
        user = conn.execute("SELECT id FROM users WHERE id = ?", (str(m.from_user.id),)).fetchone()
        if not user:
            conn.execute("INSERT INTO users (id, balance, click_lvl, last_active) VALUES (?, 1000, 1, ?)", 
                         (str(m.from_user.id), int(time.time())))
            conn.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    
    await m.answer(
        f"<b>Neural Pulse AI | Ultimate Gold</b>\n\nПротокол доступа: <code>{m.from_user.id}</code>\nСистема готова к транзакциям.", 
        reply_markup=kb
    )

# --- СТАТИКА ---
if IMAGES_DIR.exists():
    app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

@app.get("/")
async def index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse(status_code=404, content={"error": "index.html not found"})

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
