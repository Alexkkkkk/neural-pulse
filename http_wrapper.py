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

# --- КОНФИГУРАЦИЯ ---
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
ADMIN_ID = "476014374"
DOMAIN = "ai.bothost.ru"
DB_PATH = "game.db"
VERSION = "3.1.4-ULTIMATE"

# Принудительно отключаем буферизацию для логов Bothost
os.environ["PYTHONUNBUFFERED"] = "1"

# --- ИНИЦИАЦИЯ FASTAPI ---
app = FastAPI(title="Neural Pulse AI", version=VERSION)

# CORS для стабильной работы Web App из Telegram
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Монтируем статику (проверь, что папка /static существует в корне)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- БАЗА ДАННЫХ ---
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                balance INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                last_tap TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        conn.commit()
    print(f"🗄️ [DB]: База данных инициализирована. Версия {VERSION}", flush=True)

def update_user_balance(user_id: str, clicks: int):
    if clicks <= 0 or clicks > 500: return
    try:
        with sqlite3.connect(DB_PATH) as conn:
            # Атомарный UPSERT: прибавляем баланс и обновляем уровень (1 лвл за каждые 1000 кликов)
            conn.execute('''
                INSERT INTO users (id, balance, level) 
                VALUES (?, ?, ?) 
                ON CONFLICT(id) DO UPDATE SET 
                    balance = balance + EXCLUDED.balance,
                    level = ((balance + EXCLUDED.balance) / 1000) + 1,
                    last_tap = CURRENT_TIMESTAMP;
            ''', (user_id, clicks, (clicks // 1000) + 1))
            conn.commit()
        print(f"💎 [TAP]: Пользователь {user_id} | +{clicks}", flush=True)
    except Exception as err:
        print(f"❌ [DB ERROR]: {err}", flush=True)

# --- МОДЕЛИ ДАННЫХ ---
class ClickData(BaseModel):
    user_id: str
    clicks: int

# --- API МАРШРУТЫ ---

@app.get("/", response_class=HTMLResponse)
async def index():
    """Главная страница приложения"""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Frontend Error: index.html not found</h1>"

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    """Получение данных игрока"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT balance, level FROM users WHERE id = ?", (user_id,))
        result = cursor.fetchone()
        return JSONResponse({
            "balance": result[0],
            "level": result[1]
        }) if result else JSONResponse({"balance": 0, "level": 1})

@app.post("/api/clicks")
async def save_clicks(click_data: ClickData, background_tasks: BackgroundTasks):
    """Асинхронное сохранение кликов"""
    background_tasks.add_task(update_user_balance, click_data.user_id, click_data.clicks)
    return {"status": "ok"}

@app.get("/api/leaderboard")
async def leaderboard():
    """Топ-10 игроков"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, balance, level FROM users ORDER BY balance DESC LIMIT 10;")
        rows = cursor.fetchall()
        return [{"id": r[0], "balance": r[1], "level": r[2]} for r in rows]

# --- TELEGRAM BOT ---
bot = Bot(token=TOKEN)
dp = Dispatcher()

async def notify_admin():
    try:
        await bot.send_message(
            chat_id=ADMIN_ID,
            text=f"🚀 <b>Neural Pulse AI запущена!</b>\n\n✅ Система онлайн\n📦 Версия: <code>{VERSION}</code>",
            parse_mode="HTML"
        )
        print(f"🔔 [NOTIFY]: Уведомление администратору отправлено.", flush=True)
    except Exception as e:
        print(f"⚠️ [NOTIFY ERROR]: {e}")

@dp.message()
async def start_handler(message: types.Message):
    builder = InlineKeyboardBuilder()
    web_app_url = f"https://{DOMAIN}/?v={int(time.time())}"
    builder.row(types.InlineKeyboardButton(text="⚡ ИГРАТЬ ⚡", web_app=WebAppInfo(url=web_app_url)))

    await message.answer(
        "<b>Neural Pulse AI</b>\n\nТвоя энергия — твоя валюта. Нажми кнопку ниже, чтобы начать!",
        reply_markup=builder.as_markup(),
        parse_mode="HTML"
    )

async def run_bot():
    """Запуск бота в асинхронном режиме"""
    await bot.delete_webhook(drop_pending_updates=True)
    await notify_admin()
    # handle_signals=False позволяет боту работать в Threading
    await dp.start_polling(bot, handle_signals=False)

# --- ГЛАВНЫЙ ЗАПУСК ---
if __name__ == "__main__":
    init_db()

    # Запускаем бота в daemon-потоке
    bot_thread = threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True)
    bot_thread.start()

    # Запускаем сервер (порт 3000 по умолчанию для Bothost)
    port = int(os.getenv("PORT", 3000))
    print(f"🚀 [SERVER]: Запуск на порту {port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
