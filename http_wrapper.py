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
TOKEN = "8257287930:AAG13nP9Qgzeu-i3UU4d1sB3Kfaid2oPF-c"
DOMAIN = "ai.bothost.ru"
DB_PATH = "game.db"
VERSION = "2.3.1-FIX" 

# Принудительный вывод логов
os.environ["PYTHONUNBUFFERED"] = "1"

app = FastAPI()
bot = Bot(token=TOKEN)
dp = Dispatcher()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- МИДДЛВАРЫ И FAVICON ---
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

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
        print(f"🗄️ [DB]: База данных готова", flush=True)
    except Exception as e:
        print(f"❌ [DB ERROR]: {e}", flush=True)

# --- МАРШРУТЫ API ---
@app.get("/")
async def serve_index():
    index_path = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

@app.get("/api/get_balance/{user_id}")
async def get_balance(user_id: int):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            res = conn.execute("SELECT balance FROM users WHERE id = ?", (user_id,)).fetchone()
            return {"balance": res[0] if res else 0}
    except:
        return {"balance": 0}

@app.post("/api/save_clicks")
async def save_clicks(data: dict = Body(...)):
    user_id = data.get("user_id")
    clicks = data.get("clicks", 0)
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("INSERT INTO users (id, balance) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET balance = balance + ?", 
                         (user_id, clicks, clicks))
            conn.commit()
        return {"status": "ok"}
    except:
        return {"status": "error"}

# --- СТАТИКА ---
static_dir = os.path.join(BASE_DIR, "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    # Диагностика файла unnamed3.png
    img_path = os.path.join(static_dir, "images", "unnamed3.png")
    if os.path.exists(img_path):
        print(f"✅ [ASSETS]: unnamed3.png найден!", flush=True)
    else:
        print(f"⚠️ [ASSETS ERROR]: Файл {img_path} ОТСУТСТВУЕТ!", flush=True)
else:
    print(f"⚠️ [STATIC ERROR]: Папка static не найдена!", flush=True)

# --- БОТ ---
@dp.message()
async def start_handler(message: types.Message):
    builder = InlineKeyboardBuilder()
    url = f"https://{DOMAIN}/?v={int(time.time())}"
    builder.row(types.InlineKeyboardButton(text="💎 ИГРАТЬ", web_app=WebAppInfo(url=url)))
    await message.answer(f"Neural Pulse AI v{VERSION}\nУдачной игры!", reply_markup=builder.as_markup())

async def run_bot():
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        me = await bot.get_me()
        print(f"🤖 [BOT]: Запущен @{me.username}", flush=True)
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ [BOT ERROR]: {e}", flush=True)

# --- ЗАПУСК ---
if __name__ == "__main__":
    print("\n" + "="*50)
    print(f"🚀 ЗАПУСК СЕРВЕРА ВЕРСИИ {VERSION}")
    print("="*50 + "\n", flush=True)
    
    init_db()
    
    # Бот
    bot_thread = threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True)
    bot_thread.start()
    
    # Сервер
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
