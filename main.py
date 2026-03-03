import os, asyncio, logging, time, datetime, sys
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update, FSInputFile
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandObject, Command

# --- [STAGE 0] ЦВЕТА И ЛОГИ ---
C_GREEN, C_BLUE, C_YELLOW, C_RED, C_BOLD, C_CYAN, C_MAGENTA, C_WHITE, C_END = (
    "\033[92m", "\033[94m", "\033[93m", "\033[91m", "\033[1m", "\033[96m", "\033[95m", "\033[97m", "\033[0m"
)

def log_step(category: str, message: str, color: str = C_WHITE):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C_BOLD}[{curr_time}]{C_END} {color}{category.ljust(12)}{C_END} | {message}", flush=True)

# --- CONFIG ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
ADMIN_ID = 476014374 
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"

# --- SCHEMAS ---
class SaveData(BaseModel):
    model_config = ConfigDict(extra="allow")
    user_id: str
    score: Optional[float] = 0.0
    click_lvl: Optional[int] = 1
    energy: Optional[float] = 1000.0
    max_energy: Optional[int] = 1000
    pnl: Optional[float] = 0.0
    level: Optional[int] = 1
    exp: Optional[int] = 0
    wallet: Optional[str] = None

# --- BOT API ---
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- BACKUP ---
async def backup_task():
    while True:
        await asyncio.sleep(86400)
        try:
            if DB_PATH.exists():
                file = FSInputFile(DB_PATH, filename=f"backup_{datetime.date.today()}.db")
                await bot.send_document(ADMIN_ID, file, caption=f"📦 #BACKUP {datetime.date.today()}")
                log_step("BACKUP", "Успешно отправлен админу", C_GREEN)
        except Exception as e: log_step("BACKUP_ERR", str(e), C_RED)

# --- DATABASE ---
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
             energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
             level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0,
             wallet TEXT DEFAULT NULL, referrer_id TEXT DEFAULT NULL, referrals_count INTEGER DEFAULT 0,
             ref_balance REAL DEFAULT 0, tasks_completed TEXT DEFAULT "")''')
        await db.commit()
        log_step("DB", "База данных синхронизирована", C_GREEN)

# --- [AGRESSIVE LIFESPAN] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    log_step("SYSTEM", "ЗАПУСК АГРЕССИВНОГО РЕЖИМА...", C_MAGENTA)
    await init_db()
    asyncio.create_task(backup_task())
    
    # Сверх-агрессивный сброс вебхука
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    try:
        log_step("WEBHOOK", "Принудительный сброс старых соединений...", C_YELLOW)
        await bot.delete_webhook(drop_pending_updates=True)
        await asyncio.sleep(2) # Даем Telegram время на очистку очереди
        
        await bot.set_webhook(
            url=webhook_url,
            drop_pending_updates=True,
            allowed_updates=["message", "callback_query", "my_chat_member"],
            max_connections=100
        )
        log_step("WEBHOOK", f"Установлен принудительно: {webhook_url}", C_CYAN)
    except Exception as e:
        log_step("WEBHOOK_ERR", f"Критическая ошибка: {e}", C_RED)
    
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ---
@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (str(user_id),)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            await db.execute("INSERT INTO users (id, balance, last_active) VALUES (?, 1000, ?)", (user_id, now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "level": 1, "energy": 1000, "click_lvl": 1, "pnl": 0}}
        
        u = dict(user)
        # Оффлайн доход
        if u['pnl'] > 0 and u['last_active'] > 0:
            earned = ((now - u['last_active']) / 3600) * u['pnl']
            if earned > 0:
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", (u['balance'], now, user_id))
                await db.commit()
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, wallet=?, last_active=? WHERE id=?", 
                (float(data.score), int(data.click_lvl), float(data.energy), int(data.max_energy), float(data.pnl), int(data.level), int(data.exp), data.wallet, int(time.time()), str(data.user_id))
            )
            await db.commit()
        return {"status": "ok"}
    except Exception: return JSONResponse({"status": "error"}, status_code=400)

@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
    except Exception: pass
    return {"ok": True}

# --- HANDLERS ---
@dp.message(Command("start"))
async def cmd_start(m: types.Message, command: CommandObject):
    user_id = str(m.from_user.id)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))]
    ])
    await m.answer(f"<b>Neural Pulse Online</b>\n\nСистема инициализирована.\nОператор: <code>{user_id}</code>", reply_markup=kb)

# --- STATIC & INDEX ---
app.mount("/images", StaticFiles(directory=str(BASE_DIR / "images")), name="images")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

@app.get("/")
async def index():
    # Добавляем заголовки против кэширования для WebApp
    return FileResponse(BASE_DIR / "index.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 3000)), access_log=False)
