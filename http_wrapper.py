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
VERSION = "3.1.5-FINAL"

# Принудительная буферизация для Bothost
os.environ["PYTHONUNBUFFERED"] = "1"

# --- ИНИЦИАЦИЯ FastAPI ---
app = FastAPI(title="Neural Pulse AI", version=VERSION)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Настройка статических файлов
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
if not os.path.exists(STATIC_DIR): os.makedirs(STATIC_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- БАЗА ДАННЫХ ---
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
            level INTEGER DEFAULT 1, last_tap TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
        conn.commit()
    print(f"🗄️ [DB]: База инициализирована. Версия {VERSION}", flush=True)

def update_db(user_id: str, clicks: int):
    """Атомарный инкремент баланса и расчет уровня"""
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

# --- API ---
@app.get("/", response_class=HTMLResponse)
async def index():
    path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(path):
        return open(path, "r", encoding="utf-8").read()
    return "<h1>Neural Pulse: Frontend Missing</h1>"

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        res = conn.execute("SELECT balance, level FROM users WHERE id = ?", (user_id,)).fetchone()
        return JSONResponse({"balance": res[0], "level": res[1]} if res else {"balance": 0, "level": 1})

@app.post("/api/clicks")
async def save_clicks(data: ClickData, tasks: BackgroundTasks):
    # Используем BackgroundTasks, чтобы API отвечало мгновенно
    tasks.add_task(update_db, data.user_id, data.clicks)
    return {"status": "ok"}

# --- BOT ---
bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message()
async def start_handler(m: types.Message):
    builder = InlineKeyboardBuilder()
    # URL с меткой времени для обхода кэша Telegram
    web_app_url = f"https://{DOMAIN}/?v={int(time.time())}"
    builder.row(types.InlineKeyboardButton(text="⚡ ИГРАТЬ ⚡", web_app=WebAppInfo(url=web_app_url)))
    await m.answer(
        "<b>Neural Pulse AI</b>\n\nТвоя энергия — твоя валюта. Начни добычу прямо сейчас!", 
        reply_markup=builder.as_markup(), 
        parse_mode="HTML"
    )

async def run_bot():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, handle_signals=False)

# --- ЗАПУСК ---
if __name__ == "__main__":
    init_db()
    # Бот в отдельном потоке
    threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True).start()
    # Сервер в основном потоке
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 3000)))
