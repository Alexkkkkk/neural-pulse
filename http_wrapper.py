import os
import sqlite3
import asyncio
import threading
import time
import uvicorn
from fastapi import FastAPI, Body, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

# --- КОНФИГУРАЦИЯ ---
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
ADMIN_ID = "476014374"  # Твой ID из логов
DOMAIN = "ai.bothost.ru"
DB_PATH = "game.db"
VERSION = "3.1.2-FINAL"

os.environ["PYTHONUNBUFFERED"] = "1"

class ClickData(BaseModel):
    user_id: str
    clicks: int

app = FastAPI(title="Neural Pulse AI", version=VERSION)
bot = Bot(token=TOKEN)
dp = Dispatcher()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- БАЗА ДАННЫХ ---
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, 
                balance INTEGER DEFAULT 0, 
                level INTEGER DEFAULT 1, 
                last_tap TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    print(f"🗄️ [DB]: База готова. Версия {VERSION}", flush=True)

def db_update_balance(user_id: str, clicks: int):
    if clicks < 0 or clicks > 500: return # Защита от накрутки
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                INSERT INTO users (id, balance, level) 
                VALUES (?, ?, 1) 
                ON CONFLICT(id) DO UPDATE SET 
                    balance = balance + EXCLUDED.balance,
                    level = ( (balance + EXCLUDED.balance) / 1000 ) + 1,
                    last_tap = CURRENT_TIMESTAMP
            """, (user_id, clicks))
            conn.commit()
        print(f"💎 [SCORE]: {user_id} натапал +{clicks}", flush=True)
    except Exception as e:
        print(f"❌ [DB ERROR]: {e}", flush=True)

# --- API МАРШРУТЫ ---
@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/api/get_balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT balance, level FROM users WHERE id = ?", (user_id,)).fetchone()
        if row:
            return {"balance": row[0], "level": row[1]}
        return {"balance": 0, "level": 1}

@app.post("/api/save_clicks")
async def save_clicks(tasks: BackgroundTasks, data: ClickData):
    tasks.add_task(db_update_balance, data.user_id, data.clicks)
    return {"status": "ok"}

@app.get("/api/leaderboard")
async def get_leaderboard():
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("SELECT id, balance, level FROM users ORDER BY balance DESC LIMIT 10").fetchall()
        return [{"id": r[0], "balance": r[1], "level": r[2]} for r in rows]

# --- СТАТИКА ---
static_path = os.path.join(BASE_DIR, "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# --- УВЕДОМЛЕНИЕ О ЗАПУСКЕ ---
async def send_startup_notify():
    try:
        await bot.send_message(
            ADMIN_ID, 
            f"🚀 <b>Neural Pulse AI ЗАПУЩЕН!</b>\n\n"
            f"✅ Система онлайн\n"
            f"📦 Версия: <code>{VERSION}</code>\n"
            f"📊 База данных: Подключена",
            parse_mode="HTML"
        )
        print(f"🔔 [NOTIFY]: Уведомление отправлено админу", flush=True)
    except Exception as e:
        print(f"⚠️ [NOTIFY ERROR]: {e}", flush=True)

@dp.message()
async def start_handler(message: types.Message):
    builder = InlineKeyboardBuilder()
    url = f"https://{DOMAIN}/?v={int(time.time())}"
    builder.row(types.InlineKeyboardButton(text="⚡ ИГРАТЬ ⚡", web_app=WebAppInfo(url=url)))
    await message.answer(
        f"<b>Neural Pulse AI</b>\n\nТвоя энергия на пределе! Нажимай на сферу и качай свой уровень. 🚀",
        reply_markup=builder.as_markup(),
        parse_mode="HTML"
    )

async def run_bot():
    await bot.delete_webhook(drop_pending_updates=True)
    await send_startup_notify() # Оповещение при старте
    await dp.start_polling(bot)

# --- ЗАПУСК ---
if __name__ == "__main__":
    init_db()
    bot_thread = threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True)
    bot_thread.start()
    
    port = int(os.getenv("PORT", 3000))
    print(f"🚀 [SERVER]: Запуск на порту {port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)
