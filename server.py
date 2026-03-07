import asyncio, logging, os
import aiosqlite, uvicorn
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, ORJSONResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from contextlib import asynccontextmanager

# Импорт твоей логики из папок
from src.controllers.userController import db_syncer, USER_CACHE
from src.routes.api import get_balance_logic, LAST_SAVE

BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "data" / "game.db" # Путь к папке data
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"
WEB_APP_URL = "https://np.bothost.ru"

bot = Bot(token=API_TOKEN)
db_conn = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    os.makedirs(BASE_DIR / "data", exist_ok=True)
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("""CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
        pnl REAL DEFAULT 0, energy REAL, max_energy INTEGER, 
        level INTEGER DEFAULT 1, last_active INTEGER)""")
    await db_conn.commit()

    asyncio.create_task(db_syncer(db_conn))
    dp = Dispatcher()

    @dp.message(Command("start"))
    async def start(m: types.Message):
        uid = str(m.from_user.id)
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="ВХОД В НЕЙРОСЕТЬ 🧠", web_app=WebAppInfo(url=f"{WEB_APP_URL}/?u={uid}"))]
        ])
        await m.answer(f"🦾 <b>Neural Pulse: Протокол Запущен</b>", reply_markup=kb, parse_mode="HTML")

    polling_task = asyncio.create_task(dp.start_polling(bot))
    yield
    polling_task.cancel()
    await db_conn.close()

app = FastAPI(lifespan=lifespan, default_response_class=ORJSONResponse)

@app.get("/api/balance/{user_id}")
async def get_bal(user_id: str):
    return await get_balance_logic(user_id, db_conn, aiosqlite)

@app.post("/api/save")
async def save_state(request: Request):
    data = await request.json()
    uid = str(data.get("user_id"))
    now = time.time()
    if now - LAST_SAVE.get(uid, 0) < 0.4: return {"status": "fast"}
    LAST_SAVE[uid] = now
    USER_CACHE[uid] = {"data": data}
    return {"status": "ok"}

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
