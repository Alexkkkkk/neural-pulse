import os, asyncio, sqlite3, uvicorn, logging
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКА ПУТЕЙ ---
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = STATIC_DIR / "images"
DB_PATH = BASE_DIR / "game.db"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")

# Твои настройки
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"

bot = Bot(token=TOKEN)
dp = Dispatcher()

# --- ИНИЦИАЛИЗАЦИЯ БД И ЖИЗНЕННЫЙ ЦИКЛ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            # Унифицированная таблица: id, balance и уровень клика
            conn.execute('''CREATE TABLE IF NOT EXISTS users 
                            (id TEXT PRIMARY KEY, 
                             balance INTEGER DEFAULT 0, 
                             click_lvl INTEGER DEFAULT 1)''')
            conn.commit()
        logger.info("🗄️ База данных готова и проверена.")
    except Exception as e:
        logger.error(f"❌ DB ERROR: {e}")

    # Запуск бота в фоне
    polling_task = asyncio.create_task(dp.start_polling(bot))
    logger.info(f"✅ Бот Neural Pulse запущен.")
    
    yield
    
    polling_task.cancel()
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

# Настройки CORS, чтобы Mini App мог делать запросы
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# Монтируем статику (картинки, стили)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=str(BASE_DIR))

# --- API ЭНДПОИНТЫ (Логика из Flask перенесена сюда) ---

@app.get("/")
async def serve_game(request: Request):
    """Отдает главную страницу игры"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    """Получение баланса и уровня клика"""
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row:
            conn.execute("INSERT INTO users (id, balance, click_lvl) VALUES (?, 0, 1)", (user_id,))
            conn.commit()
            return {"balance": 0, "click_lvl": 1}
        return {"balance": row[0], "click_lvl": row[1]}

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    """Сохранение накликанных поинтов"""
    uid = str(data.get("user_id"))
    clicks = int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (clicks, uid))
        conn.commit()
    return {"status": "ok"}

@app.post("/api/buy_boost")
async def buy_boost(data: dict = Body(...)):
    """Покупка улучшения (Boost)"""
    uid = str(data.get("user_id"))
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl FROM users WHERE id = ?", (uid,))
        row = c.fetchone()
        
        if not row:
            return {"error": "User not found"}
        
        balance, lvl = row[0], row[1]
        cost = lvl * 500  # Твоя формула: 500, 1000, 1500...
        
        if balance >= cost:
            new_balance = balance - cost
            new_lvl = lvl + 1
            conn.execute("UPDATE users SET balance = ?, click_lvl = ? WHERE id = ?", 
                         (new_balance, new_lvl, uid))
            conn.commit()
            return {
                "status": "ok", 
                "new_balance": new_balance, 
                "new_lvl": new_lvl, 
                "next_cost": new_lvl * 500
            }
        return {"error": "Недостаточно NP!"}

@app.get("/api/all_stats")
async def get_all_stats():
    """Общая статистика для модального окна Stats"""
    with sqlite3.connect(str(DB_PATH)) as conn:
        res = conn.execute("SELECT COUNT(*), SUM(balance) FROM users").fetchone()
        return {
            "total_players": res[0] or 0, 
            "total_balance": res[1] or 0
        }

# --- ЛОГИКА ТЕЛЕГРАМ-БОТА ---
@dp.message(F.text == "/start")
async def start_handler(message: types.Message):
    v = int(datetime.now().timestamp())
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="💎 Запустить Neural Pulse", 
            web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/?v={v}")
        )
    ]])
    await message.answer(
        f"Привет, {message.from_user.first_name}! 🚀\n\n"
        "Добро пожаловать в Neural Pulse — нейросетевой кликер будущего.\n"
        "Нажимай на сферу, копи NP и прокачивай свой интеллект!", 
        reply_markup=kb
    )

if __name__ == "__main__":
    # Запуск сервера на порту 3000 (стандарт для FastAPI на хостингах)
    uvicorn.run(app, host="0.0.0.0", port=3000)
