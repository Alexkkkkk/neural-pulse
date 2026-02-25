import os
import sqlite3
import asyncio
import threading
import time
import uvicorn
from fastapi import FastAPI, Body, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

# --- КОНФИГУРАЦИЯ ---
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
DOMAIN = "ai.bothost.ru"
DB_PATH = "game.db"
VERSION = "2.5.0-TOP-1" # Твоя тапалка номер один

os.environ["PYTHONUNBUFFERED"] = "1"

app = FastAPI(title="Neural Pulse AI", version=VERSION)
bot = Bot(token=TOKEN)
dp = Dispatcher()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- MIDDLEWARE (Для мгновенного обновления без кеша) ---
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# --- БАЗА ДАННЫХ (Тип ID изменен на TEXT для надежности Telegram ID) ---
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
        conn.commit()
    print(f"🗄️ [DB]: База данных готова")

# --- API И РОУТИНГ ---
@app.get("/")
async def serve_index():
    index_path = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT balance FROM users WHERE id = ?", (user_id,)).fetchone()
        return {"balance": row[0] if row else 0}

@app.post("/api/update_balance")
async def update_balance(data: dict = Body(...)):
    user_id = str(data.get("user_id"))
    clicks = data.get("clicks", 0)
    with sqlite3.connect(DB_PATH) as conn:
        # Сначала создаем пользователя, если его нет
        conn.execute("INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)", (user_id,))
        # Затем прибавляем клики
        conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (clicks, user_id))
        conn.commit()
    return {"status": "ok"}

# --- СТАТИКА ---
static_path = os.path.join(BASE_DIR, "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# --- БОТ ---
@dp.message()
async def start_handler(message: types.Message):
    builder = InlineKeyboardBuilder()
    # Ссылка без /api/, чтобы index.html грузился из корня
    url = f"https://{DOMAIN}/?v={int(time.time())}"
    builder.row(types.InlineKeyboardButton(text="💎 ИГРАТЬ", web_app=WebAppInfo(url=url)))
    
    welcome_text = (
        f"<b>Neural Pulse AI [v{VERSION}]</b>\n\n"
        f"Добро пожаловать в лучшую тапалку!\n"
        f"Жми на кнопку ниже, чтобы начать майнинг."
    )
    await message.answer(welcome_text, reply_markup=builder.as_markup(), parse_mode="HTML")

async def run_bot():
    print(f"🤖 [BOT]: Запуск...")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, handle_signals=False)

# --- ЗАПУСК ---
if __name__ == "__main__":
    init_db()

    # Запускаем бота в отдельном потоке
    bot_thread = threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True)
    bot_thread.start()

    # Запускаем FastAPI сервер (Порт 8000 как в твоем примере)
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 [SERVER]: Running on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
