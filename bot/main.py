import os
import logging
import asyncio
import sqlite3
import time
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder
from contextlib import asynccontextmanager

# --- НАСТРОЙКИ ---
DOMAIN = "ai.bothost.ru"
DB_PATH = "game.db" 
TOKEN = "8257287930:AAEh-qqN3sUtSS7cytlq9hK3_d0pbJW7-OU"

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-8s | %(message)s')
logger = logging.getLogger("PULSE")

bot = Bot(token=TOKEN)
dp = Dispatcher()

def find_index_html():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    search_paths = [
        os.path.join(base_dir, "index.html"),
        "index.html"
    ]
    for p in search_paths:
        if os.path.exists(p): 
            return p
    return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 [SYSTEM]: Сервер запускается на {DOMAIN}")
    # Инициализация БД
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 0)")
    
    # Запуск бота
    await bot.delete_webhook(drop_pending_updates=True)
    asyncio.create_task(dp.start_polling(bot))
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Раздача картинок (создаем папку если нет, чтобы не было 404)
images_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "images")
if not os.path.exists(images_path):
    os.makedirs(images_path)
app.mount("/images", StaticFiles(directory=images_path), name="images")

# --- API ---

@app.get("/api/get_balance")
async def get_balance(user_id: int):
    try:
        with sqlite3.connect(DB_PATH, timeout=10) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
            result = cursor.fetchone()
            return {"balance": result[0] if result else 0}
    except Exception as e:
        return {"balance": 0, "error": str(e)}

@app.post("/api/save")
async def save_score(request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")
        clicks = int(data.get("clicks", 0))
        
        if user_id is None or clicks < 0:
            return JSONResponse({"status": "error"}, status_code=400)

        with sqlite3.connect(DB_PATH, timeout=10) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)", (user_id,))
            cursor.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (clicks, user_id))
            conn.commit()
            cursor.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
            new_balance = cursor.fetchone()[0]
            
        return {"status": "success", "balance": new_balance}
    except Exception as e:
        logger.error(f"🚨 [ERR]: {e}")
        return JSONResponse({"status": "error"}, status_code=500)

@app.get("/")
async def serve_game():
    path = find_index_html()
    if path: return FileResponse(path)
    return HTMLResponse("<h1>404</h1><p>index.html не найден</p>", status_code=404)

@dp.message()
async def cmd_start(message: types.Message):
    v = int(time.time())
    web_app_url = f"https://{DOMAIN}/?v={v}"
    builder = InlineKeyboardBuilder()
    builder.button(text="💎 ИГРАТЬ", web_app=WebAppInfo(url=web_app_url))
    await message.answer(
        f"<b>⚡️ NEURAL PULSE</b>\n\nПривет, {message.from_user.first_name}!",
        reply_markup=builder.as_markup(),
        parse_mode="HTML"
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
