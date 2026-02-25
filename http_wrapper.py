import os
import sqlite3
import asyncio
import threading
import time
import uvicorn
from fastapi import FastAPI, Body, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

# --- КОНФИГУРАЦИЯ ---
TOKEN = "8257287930:AAG13nP9Qgzeu-i3UU4d1sB3Kfaid2oPF-c"
DOMAIN = "ai.bothost.ru"
DB_PATH = "game.db"
VERSION = "2.1.0-CACHE-FIX"  # Меняй эту цифру при каждом обновлении

# Принудительный вывод логов
os.environ["PYTHONUNBUFFERED"] = "1"

app = FastAPI()
bot = Bot(token=TOKEN)
dp = Dispatcher()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Middleware для сброса кэша браузера
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

# --- БАЗА ДАННЫХ ---
def init_db():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 0)")
            conn.commit()
        print(f"🗄️ [DB]: База данных инициализирована", flush=True)
    except Exception as e:
        print(f"❌ [DB ERROR]: {e}", flush=True)

# --- МАРШРУТЫ API ---
@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/api/get_balance/{user_id}")
async def get_balance(user_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        res = conn.execute("SELECT balance FROM users WHERE id = ?", (user_id,)).fetchone()
        balance = res[0] if res else 0
        print(f"💰 [API]: Запрос баланса для {user_id}: {balance}", flush=True)
        return {"balance": balance}

@app.post("/api/save_clicks")
async def save_clicks(data: dict = Body(...)):
    user_id = data.get("user_id")
    clicks = data.get("clicks", 0)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO users (id, balance) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET balance = balance + ?", 
                     (user_id, clicks, clicks))
        conn.commit()
    print(f"📥 [API]: Сохранено {clicks} кликов для {user_id}", flush=True)
    return {"status": "ok"}

# --- СТАТИКА (С ЛОГИРОВАНИЕМ ПУТЕЙ) ---
static_dir = os.path.join(BASE_DIR, "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    # Дополнительно монтируем images для совместимости
    if os.path.exists(os.path.join(static_dir, "images")):
        app.mount("/images", StaticFiles(directory=os.path.join(static_dir, "images")), name="images")
    print(f"✅ [STATIC]: Статика подключена из {static_dir}", flush=True)
else:
    print(f"⚠️ [STATIC ERROR]: Папка {static_dir} НЕ НАЙДЕНА!", flush=True)

# --- БОТ ---
@dp.message()
async def start_handler(message: types.Message):
    builder = InlineKeyboardBuilder()
    timestamp = int(time.time())
    url = f"https://{DOMAIN}/?v={timestamp}"
    builder.row(types.InlineKeyboardButton(text="💎 ИГРАТЬ", web_app=WebAppInfo(url=url)))
    await message.answer(f"Запуск версии {VERSION}...", reply_markup=builder.as_markup())

async def run_bot():
    await bot.delete_webhook(drop_pending_updates=True)
    print(f"🤖 [BOT]: Запущен @{(await bot.get_me()).username}", flush=True)
    await dp.start_polling(bot)

# --- ЗАПУСК С ГЛАВНЫМ ЛОГОМ ---
if __name__ == "__main__":
    print("\n" + "="*50)
    print(f"🚀 ОБНОВЛЕНИЕ ПРИНЯТО!")
    print(f"📦 ВЕРСИЯ: {VERSION}")
    print(f"⏰ ВРЕМЯ ЗАПУСКА: {time.strftime('%H:%M:%S')}")
    print("="*50 + "\n", flush=True)
    
    init_db()
    threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True).start()
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
