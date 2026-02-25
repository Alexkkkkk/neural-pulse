import os
import sqlite3
import asyncio
import threading
import time
import uvicorn
from fastapi import FastAPI, Body, BackgroundTasks, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

# --- КОНФИГУРАЦИЯ ---
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
DOMAIN = "ai.bothost.ru"
DB_PATH = "game.db"
VERSION = "3.0.0-ULTIMATE"

os.environ["PYTHONUNBUFFERED"] = "1"
app = FastAPI(title="Neural Pulse AI")

# CORS для стабильной работы WebApp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

bot = Bot(token=TOKEN)
dp = Dispatcher()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- ЛОГИКА БАЗЫ ДАННЫХ ---
def update_db_task(user_id: str, clicks: int):
    # Простейший анти-чит: игнорируем подозрительные запросы
    if clicks <= 0 or clicks > 1000: # Максимум 1000 кликов за один пакет (2 сек)
        return
        
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)", (user_id,))
            conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (clicks, user_id))
            conn.commit()
        print(f"💎 [SCORE]: {user_id} натапал +{clicks}", flush=True)
    except sqlite3.Error as e:
        print(f"❌ [DB ERROR]: {e}", flush=True)

# --- API МАРШРУТЫ ---

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/api/get_balance/{user_id}")
async def get_balance(user_id: str):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            row = conn.execute("SELECT balance FROM users WHERE id = ?", (user_id,)).fetchone()
            balance = row[0] if row else 0
            return {"balance": balance}
    except sqlite3.Error:
        return {"balance": 0}

@app.post("/api/save_clicks")
async def save_clicks(background_tasks: BackgroundTasks, data: dict = Body(...)):
    user_id = str(data.get("user_id"))
    clicks = int(data.get("clicks", 0))
    background_tasks.add_task(update_db_task, user_id, clicks)
    return {"status": "ok"}

# НОВИНКА: API для Таблицы Лидеров
@app.get("/api/top")
async def get_top():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            # Получаем топ 10 игроков
            rows = conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10").fetchall()
            return [{"id": r[0], "balance": r[1]} for r in rows]
    except sqlite3.Error:
        return []

# --- СТАТИКА ---
static_path = os.path.join(BASE_DIR, "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# --- БОТ ---
@dp.message()
async def start_handler(message: types.Message):
    builder = InlineKeyboardBuilder()
    url = f"https://{DOMAIN}/?v={int(time.time())}"
    builder.row(types.InlineKeyboardButton(text="⚡ ИГРАТЬ ⚡", web_app=WebAppInfo(url=url)))
    
    # Счётчик общего количества игроков для красоты
    with sqlite3.connect(DB_PATH) as conn:
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    await message.answer(
        f"<b>Добро пожаловать в Neural Pulse!</b>\n\n"
        f"🏆 В игре уже: <b>{count}</b> человек.\n"
        f"Стань лидером и намайни максимум энергии!", 
        reply_markup=builder.as_markup(), 
        parse_mode="HTML"
    )

async def run_bot():
    print(f"🤖 [BOT]: Запущен на версии {VERSION}", flush=True)
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, handle_signals=False)

if __name__ == "__main__":
    # Инициализация БД
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
    
    print(f"🚀 [ULTIMATE SERVER]: Стартуем на порту 3000", flush=True)
    threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 3000)))
