import os, asyncio, sqlite3, uvicorn, logging
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# --- НАСТРОЙКИ ---
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"
TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"
ADMIN_ID = 476014374  # Твой ID

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NEURAL_PULSE")
bot, dp = Bot(token=TOKEN), Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
            conn.commit()
        logger.info("🗄️ База данных готова.")
    except Exception as e: logger.error(f"DB Error: {e}")
    polling_task = asyncio.create_task(dp.start_polling(bot))
    await bot.delete_webhook(drop_pending_updates=True) 
    yield
    polling_task.cancel()
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=[str(BASE_DIR), str(STATIC_DIR)])

# --- API ЭНДПОИНТЫ ---

@app.get("/")
async def serve_game(request: Request):
    try:
        res = templates.TemplateResponse("index.html", {"request": request})
        res.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return res
    except: return Response(content="index.html not found", status_code=404)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon(): return Response(status_code=204)

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    with sqlite3.connect(str(DB_PATH)) as conn:
        row = conn.execute("SELECT balance FROM users WHERE id = ?", (user_id,)).fetchone()
        balance = row[0] if row else 0
        return Response(content=f'{{"balance": {balance}}}', media_type="application/json", headers={"Cache-Control": "no-store"})

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    u, c = str(data.get("user_id")), int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("INSERT INTO users (id, balance) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET balance = balance + ?", (u, c, c))
        conn.commit()
    return {"status": "ok"}

# --- БОТ: АДМИН-КОМАНДЫ ---

@dp.message(F.from_user.id == ADMIN_ID, F.text == "/stats")
async def admin_stats(m: types.Message):
    with sqlite3.connect(str(DB_PATH)) as conn:
        res = conn.execute("SELECT COUNT(*), SUM(balance) FROM users").fetchone()
        count, total = res[0] or 0, res[1] or 0
    await m.answer(f"📊 **Статистика:**\n👤 Игроков: `{count}`\n💰 Всего монет: `{total}`", parse_mode="Markdown")

@dp.message(F.from_user.id == ADMIN_ID, F.text == "/reset_all")
async def admin_reset(m: types.Message):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("DELETE FROM users")
        conn.commit()
    await m.answer("🧨 **БАЗА ДАННЫХ ОЧИЩЕНА!**\nВсе балансы сброшены.", parse_mode="Markdown")
    logger.warning(f"!!! СБРОС БАЗЫ АДМИНОМ {ADMIN_ID} !!!")

@dp.message(F.text == "/start")
async def start_handler(m: types.Message):
    v = int(datetime.now().timestamp())
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/?v={v}"))]])
    msg = "Привет! Начинай майнить кликами прямо сейчас!"
    if m.from_user.id == ADMIN_ID:
        msg = "🤝 **Добро пожаловать, Создатель!**\n\n🛠 Команды:\n/stats — статистика\n/reset_all — полный сброс"
    await m.answer(msg, reply_markup=kb, parse_mode="Markdown")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
