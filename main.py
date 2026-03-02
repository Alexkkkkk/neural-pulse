import os, sys, asyncio, sqlite3, uvicorn, logging, random, time, json
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

# Ультра-логирование (вывод в stdout обязателен для Bothost)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NeuralPulse")

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 [SYSTEM] Запуск сервера...")
    # Инициализация БД
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS users 
                (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, 
                 click_lvl INTEGER DEFAULT 1, last_active INTEGER DEFAULT 0, wallet TEXT)''')
            conn.commit()
        logger.info("📂 [DB] База данных готова")
    except Exception as e:
        logger.error(f"❌ [DB ERROR] Ошибка БД: {e}")

    # Установка Вебхука
    await bot.delete_webhook(drop_pending_updates=True)
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url)
    logger.info(f"✅ [WEBHOOK] Установлен: {webhook_url}")
    
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ---
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    logger.info(f"📥 [API GET] Запрос баланса ID: {user_id}")
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.execute("INSERT INTO users (id, balance, click_lvl, last_active) VALUES (?, 1000, 1, ?)", 
                         (user_id, int(time.time())))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1}}
        return {"status": "ok", "data": dict(user)}

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
        logger.error(f"❌ [SAVE ERROR]: {e}")
        return {"status": "error", "detail": str(e)}

# Исправленный обработчик вебхука
@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        raw_data = await request.json()
        logger.info(f"📩 [TG UPDATE] Пришли данные от Telegram")
        update = Update.model_validate(raw_data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception as e:
        logger.error(f"❌ [WEBHOOK ERROR]: {e}")
        return JSONResponse(content={"ok": False, "error": str(e)}, status_code=400)

# --- BOT LOGIC ---
@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    logger.info(f"🤖 [START] Нажал пользователь: {m.from_user.id}")
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 ИГРАТЬ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await m.answer(
        f"<b>Neural Pulse AI</b>\n\nСистема инициализирована.\nВаш ID: <code>{m.from_user.id}</code>\n\nНажмите кнопку ниже для запуска терминала:", 
        reply_markup=kb
    )

# --- STATIC ---
# Сначала монтируем изображения, если они есть
if (STATIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images")

# Затем общую статику
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"error": "index.html not found in static folder"}

if __name__ == "__main__":
    # Порт 3000 важен для Bothost
    uvicorn.run(app, host="0.0.0.0", port=3000)
