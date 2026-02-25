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
TOKEN = "8257287930:AAEh-qqN3sUtSS7cytlq9hK3_d0pbJW7-OU"
DOMAIN = "ai.bothost.ru"
DB_PATH = "game.db"

os.environ["PYTHONUNBUFFERED"] = "1"

app = FastAPI()
bot = Bot(token=TOKEN)
dp = Dispatcher()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

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
        print("🗄️ [DB]: База данных готова", flush=True)
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
        return {"balance": res[0] if res else 0}

@app.post("/api/save_clicks")
async def save_clicks(data: dict = Body(...)):
    user_id = data.get("user_id")
    clicks = data.get("clicks", 0)
    if not user_id:
        return JSONResponse(status_code=400, content={"status": "error", "message": "no user_id"})
    
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO users (id, balance) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET balance = balance + ?", 
                     (user_id, clicks, clicks))
        conn.commit()
    return {"status": "ok"}

# --- УМНОЕ ПОДКЛЮЧЕНИЕ СТАТИКИ ---
# Монтируем /static/images из твоего проекта на URL /images
static_images_dir = os.path.join(BASE_DIR, "static", "images")

if os.path.exists(static_images_dir):
    app.mount("/images", StaticFiles(directory=static_images_dir), name="images")
    print(f"✅ [STATIC]: Картинки найдены в {static_images_dir} и доступны по /images/", flush=True)
else:
    alt_dir = os.path.join(BASE_DIR, "images")
    if os.path.exists(alt_dir):
        app.mount("/images", StaticFiles(directory=alt_dir), name="images")
        print(f"✅ [STATIC]: Картинки найдены в корневой папке /images/", flush=True)
    else:
        print(f"⚠️ [STATIC ERROR]: Папка с изображениями не найдена!", flush=True)

# --- ЛОГИКА ТЕЛЕГРАМ БОТА ---

@dp.message()
async def start_handler(message: types.Message):
    # Используем InlineKeyboardBuilder для Aiogram 3.x
    builder = InlineKeyboardBuilder()
    url = f"https://{DOMAIN}/?v={int(time.time())}"
    
    # ВАЖНО: используем WebAppInfo, чтобы открылось окно ВНУТРИ Telegram
    builder.row(types.InlineKeyboardButton(
        text="💎 ИГРАТЬ", 
        web_app=WebAppInfo(url=url))
    )
    
    name = message.from_user.first_name
    await message.answer(
        f"Привет, {name}! Нажимай на кнопку для старта:", 
        reply_markup=builder.as_markup()
    )

async def run_bot():
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        print("🤖 [BOT]: Бот запущен!", flush=True)
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ [BOT ERROR]: {e}", flush=True)

def bot_thread():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(run_bot())

# --- ЗАПУСК ---

if __name__ == "__main__":
    print("--- ПРОВЕРКА ЗАПУСКА НОВОЙ ВЕРСИИ ---", flush=True)
    init_db()
    threading.Thread(target=bot_thread, daemon=True).start()
    port = int(os.getenv("PORT", 3000))
    print(f"📡 [SERVER]: Работаем на порту {port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)
