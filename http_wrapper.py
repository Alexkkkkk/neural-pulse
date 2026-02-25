import os
import asyncio
import sqlite3
import uvicorn
import logging
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

TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")

bot = Bot(token=TOKEN)
dp = Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. БД + ОЧИСТКА
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            # Создаем таблицу, если её нет
            conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
            
            # --- ВОТ ОНА ОЧИСТКА ПРИ СТАРТЕ ---
            # Эта команда удалит всех пользователей и их балансы при каждом перезапуске бота
            conn.execute("DELETE FROM users") 
            # ----------------------------------
            
            conn.commit()
        logger.info(f"🗄️ [DB]: База очищена и готова к работе (путь: {DB_PATH})")
    except Exception as e:
        logger.error(f"❌ [DB ERROR]: {e}")

    # 2. БОТ (с очисткой очереди сообщений)
    polling_task = None
    try:
        # drop_pending_updates=True — это тоже очистка, но старых сообщений от юзеров
        await bot.delete_webhook(drop_pending_updates=True)
        polling_task = asyncio.create_task(dp.start_polling(bot))
        logger.info("✅ [BOT]: Поллинг запущен (старые сообщения удалены)!")
    except Exception as e:
        logger.error(f"❌ [BOT ERROR]: {e}")
    
    yield
    
    if polling_task:
        polling_task.cancel()
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# МОНТИРОВАНИЕ
if IMAGES_DIR.exists():
    app.mount("/static/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=[str(BASE_DIR), str(STATIC_DIR)])

# --- API ---

@app.get("/")
async def serve_game(request: Request):
    try:
        return templates.TemplateResponse("index.html", {"request": request})
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
        return {"balance": row[0] if row else 0}

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    uid = str(data.get("user_id"))
    clicks = int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute(
            "INSERT INTO users (id, balance) VALUES (?, ?) "
            "ON CONFLICT(id) DO UPDATE SET balance = balance + ?", 
            (uid, clicks, clicks)
        )
    return {"status": "ok"}

# --- БОТ ---

@dp.message(F.text == "/start")
async def start_handler(message: types.Message):
    v = int(datetime.now().timestamp())
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/?v={v}"))
    ]])
    await message.answer(f"Привет! База данных была обнулена. Начинай майнить заново!", reply_markup=kb)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
