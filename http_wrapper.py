import os
import sqlite3
import asyncio
import threading
import time
import uvicorn
from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

# --- КОНФИГУРАЦИЯ (Environment Variables) ---
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI")
ADMIN_ID = os.getenv("ADMIN_ID", "476014374")
DOMAIN = os.getenv("DOMAIN", "ai.bothost.ru")
DB_PATH = os.getenv("DB_PATH", "game.db")
VERSION = "3.1.5-STABLE"

# Окружение для Bothost
os.environ["PYTHONUNBUFFERED"] = "1"

# --- ИНИЦИАЛИЗАЦИЯ FastAPI ---
app = FastAPI(title="Neural Pulse AI", version=VERSION)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Пути к статике
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
if not os.path.exists(STATIC_DIR): os.makedirs(STATIC_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- ЛОГИКА БАЗЫ ДАННЫХ ---
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
            level INTEGER DEFAULT 1, last_tap TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
        conn.commit()
    print("🗄️ [DB]: База данных готова.", flush=True)

def update_user_stats(user_id: str, clicks: int):
    """Атомарное обновление баланса и расчет уровня (1000 кликов = +1 уровень)"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute('''INSERT INTO users (id, balance, level) VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                balance = balance + EXCLUDED.balance,
                level = ((balance + EXCLUDED.balance) / 1000) + 1,
                last_tap = CURRENT_TIMESTAMP''', (user_id, clicks, (clicks // 1000) + 1))
            conn.commit()
    except Exception as e: print(f"❌ [DB ERROR]: {e}", flush=True)

class ClickData(BaseModel):
    user_id: str
    clicks: int

# --- API МАРШРУТЫ ---
@app.get("/", response_class=HTMLResponse)
async def index():
    path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(path):
        return open(path, "r", encoding="utf-8").read()
    return "<h1>Neural Pulse AI: Frontend files missing</h1>"

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        res = conn.execute("SELECT balance, level FROM users WHERE id = ?", (user_id,)).fetchone()
        if res:
            return JSONResponse({"balance": res[0], "level": res[1]})
        return JSONResponse({"balance": 0, "level": 1})

@app.post("/api/clicks")
async def save_clicks(data: ClickData, tasks: BackgroundTasks):
    tasks.add_task(update_user_stats, data.user_id, data.clicks)
    return {"status": "ok"}

# --- TELEGRAM BOT ---
bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message()
async def start_cmd(m: types.Message):
    builder = InlineKeyboardBuilder()
    # Формируем URL с защитой от кэша
    web_url = f"https://{DOMAIN}/?v={int(time.time())}"
    builder.row(types.InlineKeyboardButton(text="⚡ ИГРАТЬ ⚡", web_app=WebAppInfo(url=web_url)))
    await m.answer(
        "<b>Neural Pulse AI</b>\nТвой прогресс синхронизирован с облаком.", 
        reply_markup=builder.as_markup(), 
        parse_mode="HTML"
    )

async def run_bot():
    await bot.delete_webhook(drop_pending_updates=True)
    # handle_signals=False важен для работы в threading на Bothost
    await dp.start_polling(bot, handle_signals=False)

# --- ЗАПУСК ---
if __name__ == "__main__":
    init_db()
    
    # Запуск бота в фоне
    bot_thread = threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True)
    bot_thread.start()

    # Запуск сервера
    port = int(os.getenv("PORT", 3000))
    print(f"🚀 [SERVER]: Запущен на порту {port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
