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
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"

session_starts = {}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("NeuralPulse")

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- МОДЕЛИ ДАННЫХ ---
class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1

# --- ЖИЗНЕННЫЙ ЦИКЛ ПРИЛОЖЕНИЯ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== ЗАПУСК NEURAL PULSE ===")
    with sqlite3.connect(str(DB_PATH)) as conn:
        # Создаем таблицу и добавляем колонку wallet, если её нет
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, last_active INTEGER DEFAULT 0, wallet TEXT)''')
        conn.commit()
    
    # Установка вебхука для Telegram
    await bot.set_webhook(url=f"https://{MY_DOMAIN}/webhook", drop_pending_updates=True)
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

# Разрешаем запросы со всех доменов (CORS)
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# --- API ЭНДПОИНТЫ ---

@app.get("/api/leaderboard")
async def get_leaderboard():
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT id, balance, last_active FROM users ORDER BY balance DESC LIMIT 10").fetchall()
            leaderboard = []
            now = time.time()
            for i, row in enumerate(rows):
                leaderboard.append({
                    "rank": i + 1,
                    "user_id": row["id"],
                    "balance": row["balance"],
                    "is_online": (now - (row["last_active"] or 0)) < 300
                })
            return {"status": "ok", "data": leaderboard}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    session_starts[user_id] = time.time()
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
    except Exception:
        return {"status": "error"}

@app.post("/api/save-wallet")
async def save_wallet(data: dict):
    uid = str(data.get("user_id"))
    addr = data.get("address")
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET wallet = ? WHERE id = ?", (addr, uid))
        conn.commit()
    return {"status": "ok"}

@app.post("/api/daily-bonus")
async def get_bonus(data: dict):
    uid = str(data.get("user_id"))
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT last_active FROM users WHERE id = ?", (uid,)).fetchone()
        # Бонус раз в 24 часа
        if user and (now - user["last_active"]) > 86400:
            reward = 5000
            conn.execute("UPDATE users SET balance = balance + ?, last_active = ? WHERE id = ?", (reward, now, uid))
            conn.commit()
            return {"status": "ok", "reward": reward}
    return {"status": "error", "message": "Еще не время!"}

@app.post("/webhook")
async def bot_webhook(request: Request):
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

# --- ЛОГИКА БОТА (AIOGRAM) ---

@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    uid = str(m.from_user.id)
    args = m.text.split()
    
    # Реферальная система: /start ref_ID
    if len(args) > 1 and args[1].startswith("ref_"):
        referrer_id = args[1].replace("ref_", "")
        if referrer_id != uid:
            with sqlite3.connect(str(DB_PATH)) as conn:
                conn.execute("UPDATE users SET balance = balance + 10000 WHERE id = ?", (referrer_id,))
                conn.commit()
                try: 
                    await bot.send_message(referrer_id, "💎 Друг зашел по ссылке! Вам начислено +10,000 NP!")
                except: 
                    pass

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 ИГРАТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(f"<b>Neural Pulse AI</b>\nДобро пожаловать, {m.from_user.first_name}!\nСистема активирована.", reply_markup=kb)

# --- СТАТИЧЕСКИЕ ФАЙЛЫ ---

# Монтируем основную папку со статикой
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Исправленная проверка наличия папки с картинками
if (STATIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images_fix")

@app.get("/")
async def index():
    # Отдаем главную страницу игры
    return FileResponse(STATIC_DIR / "index.html")

# --- ЗАПУСК ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
