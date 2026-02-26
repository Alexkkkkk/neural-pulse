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

B_DIR, TKN, DOM, ADM = Path(__file__).resolve().parent, "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI", "ai.bothost.ru", 476014374
DB_P = B_DIR / "game.db"

logging.basicConfig(level=logging.INFO)
bot, dp = Bot(token=TKN), Dispatcher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with sqlite3.connect(str(DB_P)) as cn:
            cn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)")
            cn.commit()
    except Exception as e: logging.error(f"DB Error: {e}")
    task = asyncio.create_task(dp.start_polling(bot))
    await bot.delete_webhook(drop_pending_updates=True)
    yield
    task.cancel()
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
templates = Jinja2Templates(directory=[str(B_DIR)])

@app.get("/")
async def serve(request: Request):
    try:
        res = templates.TemplateResponse("index.html", {"request": request})
        res.headers["Cache-Control"] = "no-store"
        return res
    except: return Response(content="Error", status_code=404)

@app.get("/favicon.ico", include_in_schema=False)
async def fav(): return Response(status_code=204)

@app.get("/api/balance/{uid}")
async def get_b(uid: str):
    with sqlite3.connect(str(DB_P)) as cn:
        r = cn.execute("SELECT balance FROM users WHERE id=?", (uid,)).fetchone()
    return Response(content=f'{{"balance": {r[0] if r else 0}}}', media_type="application/json")

@app.post("/api/clicks")
async def save_c(data: dict = Body(...)):
    u, c = str(data.get("user_id")), int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_P)) as cn:
        cn.execute("INSERT INTO users (id, balance) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET balance = balance + ?", (u, c, c))
        cn.commit()
    return {"status": "ok"}

@dp.message(F.from_user.id == ADM, F.text == "/stats")
async def st(m: types.Message):
    with sqlite3.connect(str(DB_P)) as cn:
        r = cn.execute("SELECT COUNT(*), SUM(balance) FROM users").fetchone()
    await m.answer(f"<b>Статистика:</b>\nЮзеров: {r[0] or 0}\nNP: {r[1] or 0}", parse_mode="HTML")

@dp.message(F.from_user.id == ADM, F.text == "/reset_all")
async def rs(m: types.Message):
    with sqlite3.connect(str(DB_P)) as cn:
        cn.execute("DELETE FROM users")
        cn.commit()
    await m.answer("🧨 <b>БАЗА ОЧИЩЕНА</b>", parse_mode="HTML")

@dp.message(F.text == "/start")
async def start(m: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="💎 Играть", web_app=WebAppInfo(url=f"https://{DOM}/?v={int(datetime.now().timestamp())}"))]])
    txt = "Жми на кнопку ниже!"
    if m.from_user.id == ADM:
        txt = "<b>Добро пожаловать, Создатель!</b>\n\n🛠 Команды:\n/stats — стата\n/reset_all — сброс"
    await m.answer(txt, reply_markup=kb, parse_mode="HTML")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
