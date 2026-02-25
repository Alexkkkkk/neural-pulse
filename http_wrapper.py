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
VERSION = "2.5.2-SYNC" 

os.environ["PYTHONUNBUFFERED"] = "1"

app = FastAPI(title="Neural Pulse AI")
bot = Bot(token=TOKEN)
dp = Dispatcher()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# --- БАЗА ДАННЫХ ---
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
        conn.commit()
    print(f"🗄️ [DB]: База данных готова", flush=True)

# --- API МАРШРУТЫ (СИНХРОНИЗИРОВАНО С JS) ---

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

# JS вызывает: /api/balance/${userId}
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT balance FROM users WHERE id = ?", (user_id,)).fetchone()
        balance = row[0] if row else 0
        print(f"🔄 [GET]: Выдан баланс {balance} для игрока {user_id}", flush=True)
        return {"balance": balance}

# JS вызывает: /api/update_balance
@app.post("/api/update_balance")
async def update_balance(data: dict = Body(...)):
    user_id = str(data.get("user_id"))
    clicks = data.get("clicks", 0)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)", (user_id,))
        conn.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (clicks, user_id))
        conn.commit()
    print(f"➕ [POST]: Сохранено +{clicks} кликов для {user_id}", flush=True)
    return {"status": "ok"}

# --- СТАТИКА ---
static_path = os.path.join(BASE_DIR, "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# --- БОТ ---
@dp.message()
async def start_handler(message: types.Message):
    builder = InlineKeyboardBuilder()
    url = f"https://{DOMAIN}/?v={int(time.time())}"
    builder.row(types.InlineKeyboardButton(text="💎 ИГРАТЬ", web_app=WebAppInfo(url=url)))
    await message.answer(f"<b>Neural Pulse AI v{VERSION}</b>\nНажми кнопку, чтобы войти в игру!", 
                         reply_markup=builder.as_markup(), parse_mode="HTML")

async def run_bot():
    print(f"🤖 [BOT]: Процесс запущен", flush=True)
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, handle_signals=False)

# --- ЗАПУСК ---
if __name__ == "__main__":
    init_db()
    
    # Запуск бота
    bot_thread = threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True)
    bot_thread.start()
    
    # Запуск сервера на порту 3000 (как в твоих последних логах)
    port = int(os.getenv("PORT", 3000))
    print(f"🚀 [SERVER]: Запуск на порту {port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)
