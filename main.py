import os, sys, asyncio, sqlite3, uvicorn, logging, random, time
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

# --- НАСТРОЙКИ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru" # Убедись, что в панели Bothost этот домен привязан к боту
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("NeuralPulse")

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- МОДЕЛИ ---
class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1

# --- ЖИЗНЕННЫЙ ЦИКЛ ПРИЛОЖЕНИЯ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== ЗАПУСК NEURAL PULSE AI ===")
    
    # Инициализация БД
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, last_active INTEGER DEFAULT 0, wallet TEXT)''')
        conn.commit()
    
    # ФОРСИРОВАННАЯ УСТАНОВКА ВЕБХУКА
    # Сначала удаляем старый, затем ставим новый. Это лечит 90% проблем с запуском.
    await bot.delete_webhook(drop_pending_updates=True)
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url)
    logger.info(f"✅ Вебхук успешно установлен на: {webhook_url}")
    
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

# CORS настройки для работы Mini App с API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API ЭНДПОИНТЫ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.execute("INSERT INTO users (id, balance, last_active) VALUES (?, 1000, ?)", 
                         (user_id, int(time.time())))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1}}
        return {"status": "ok", "data": dict(user)}

@app.post("/api/save")
async def save_game(data: SaveData):
    uid = str(data.user_id)
    now = int(time.time())
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("UPDATE users SET balance=?, click_lvl=?, last_active=? WHERE id=?", 
                         (data.score, data.click_lvl, now, uid))
            conn.commit()
            return {"status": "ok"}
    except Exception as e:
        logger.error(f"Ошибка сохранения: {e}")
        return {"status": "error"}

@app.get("/api/leaderboard")
async def get_leaderboard():
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT id, balance, last_active FROM users ORDER BY balance DESC LIMIT 10").fetchall()
            now = time.time()
            lb = [{"rank": i+1, "user_id": r["id"], "balance": r["balance"], "is_online": (now - r["last_active"]) < 300} 
                  for i, r in enumerate(rows)]
            return {"status": "ok", "data": lb}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"ok": False}

# --- ЛОГИКА БОТА ---

@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    # Генерация ссылки для игры
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 ИГРАТЬ В 1 КЛИК", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    
    welcome_text = (
        f"<b>Привет, {m.from_user.first_name}!</b>\n\n"
        f"Добро пожаловать в Neural Pulse AI. Твоя задача — добывать энергию и улучшать систему.\n\n"
        f"Жми на кнопку ниже, чтобы начать!"
    )
    await m.answer(welcome_text, reply_markup=kb)

# --- СТАТИЧЕСКИЕ ФАЙЛЫ ---

# Основная статика (CSS, JS)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Изображения (с проверкой существования папки)
if (STATIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images_fix")

@app.get("/")
async def index():
    # Проверяем, существует ли index.html, чтобы не вылетало 500 ошибки
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"error": "index.html not found in static folder"}

if __name__ == "__main__":
    # Порт 3000 — стандарт для Bothost
    uvicorn.run(app, host="0.0.0.0", port=3000)
