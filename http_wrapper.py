import os, asyncio, sqlite3, uvicorn, logging
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКА ПУТЕЙ ---
BASE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = BASE_DIR / "images"
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"

# Создаем папки автоматически
IMAGES_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

# Данные бота
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"
ADM_ID = 476014374 

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")

# --- ОТЛАДКА: ПРОВЕРКА ФАЙЛОВ ПЕРЕД ЗАПУСКОМ ---
logger.info("=== ПРОВЕРКА КАРТИНОК ===")
if IMAGES_DIR.exists():
    files = os.listdir(IMAGES_DIR)
    logger.info(f"В папке images найдено файлов: {len(files)}")
    for f in files:
        logger.info(f" -> Обнаружен файл: {f}")
else:
    logger.error("!!! ПАПКА IMAGES НЕ СУЩЕСТВУЕТ !!!")

bot = Bot(token=TOKEN)
dp = Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- 1. ИНИЦИАЛИЗАЦИЯ БД ---
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
            conn.commit()
        logger.info("🗄️ [DB]: База данных готова.")
    except Exception as e:
        logger.error(f"❌ [DB ERROR]: {e}")

    # --- 2. ЗАПУСК БОТА ---
    polling_task = None
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        polling_task = asyncio.create_task(dp.start_polling(bot))
        logger.info(f"✅ [BOT]: Поллинг запущен. Админ: {ADM_ID}")
    except Exception as e:
        logger.error(f"❌ [BOT ERROR]: {e}")
    
    yield
    
    # --- 3. ЗАКРЫТИЕ ---
    if polling_task:
        polling_task.cancel()
    await bot.session.close()
    logger.info("👋 [SYSTEM]: Сервер остановлен.")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# МОНТИРОВАНИЕ СТАТИКИ
if IMAGES_DIR.exists():
    app.mount("/static/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
    logger.info(f"🖼️ [STATIC]: Картинки подключены из {IMAGES_DIR}")

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=[str(BASE_DIR), str(STATIC_DIR)])

# --- API ЭНДПОИНТЫ ---

@app.get("/")
async def serve_game(request: Request):
    try:
        res = templates.TemplateResponse("index.html", {"request": request})
        res.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return res
    except Exception:
        for p in [BASE_DIR / "index.html", STATIC_DIR / "index.html"]:
            if p.exists():
                from fastapi.responses import FileResponse
                return FileResponse(p)
        return Response(content="index.html not found", status_code=404)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        balance = row[0] if row else 0
        return Response(
            content=f'{{"balance": {balance}}}', 
            media_type="application/json",
            headers={"Cache-Control": "no-store"}
        )

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    uid, clicks = str(data.get("user_id")), int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute(
            "INSERT INTO users (id, balance) VALUES (?, ?) "
            "ON CONFLICT(id) DO UPDATE SET balance = balance + ?", 
            (uid, clicks, clicks)
        )
        conn.commit()
    return {"status": "ok"}

# --- ЛОГИКА БОТА ---

@dp.message(F.from_user.id == ADM_ID, F.text == "/stats")
async def admin_stats(message: types.Message):
    with sqlite3.connect(str(DB_PATH)) as conn:
        res = conn.execute("SELECT COUNT(*), SUM(balance) FROM users").fetchone()
    await message.answer(
        f"<b>📊 Статистика Neural Pulse:</b>\n\n👥 Игроков: {res[0] or 0}\n💰 Всего NP: {res[1] or 0}", 
        parse_mode="HTML"
    )

@dp.message(F.from_user.id == ADM_ID, F.text == "/reset_all")
async def admin_reset(message: types.Message):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("DELETE FROM users")
        conn.commit()
    await message.answer("🧨 <b>БАЗА ДАННЫХ ПОЛНОСТЬЮ ОЧИЩЕНА!</b>", parse_mode="HTML")

@dp.message(F.text == "/start")
async def start_handler(message: types.Message):
    v = int(datetime.now().timestamp())
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/?v={v}"))
    ]])
    
    text = "Добро пожаловать в Neural Pulse! Жми на кнопку, чтобы начать майнить."
    if message.from_user.id == ADM_ID:
        text = "🤝 <b>Привет, Создатель!</b>\n\n/stats — стата\n/reset_all — сброс"
        
    await message.answer(text, reply_markup=kb, parse_mode="HTML")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
