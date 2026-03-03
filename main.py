import os, asyncio, logging, time, datetime
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

# --- ANSI ЦВЕТА ---
C_GREEN = "\033[92m"
C_BLUE = "\033[94m"
C_YELLOW = "\033[93m"
C_RED = "\033[91m"
C_BOLD = "\033[1m"
C_CYAN = "\033[96m"
C_END = "\033[0m"

# --- CONFIG ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
ADMIN_ID = 476014374 # Твой ID из логов, сюда будут падать бэкапы
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"

for folder in ["static", "images"]:
    (BASE_DIR / folder).mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(message)s')
logging.getLogger("uvicorn.access").disabled = True 

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- BACKUP SYSTEM ---
async def backup_task():
    """Фоновая задача для отправки бэкапа базы данных админу раз в сутки"""
    while True:
        await asyncio.sleep(86400) # 24 часа
        try:
            if DB_PATH.exists():
                print(f"{C_CYAN}[BACKUP]{C_END} Создание резервной копии...")
                file = FSInputFile(DB_PATH, filename=f"backup_{datetime.date.today()}.db")
                await bot.send_document(ADMIN_ID, file, caption=f"📦 #BACKUP\nСистемный бэкап базы данных\nДата: {datetime.date.today()}")
                print(f"{C_GREEN}[SUCCESS]{C_END} Бэкап отправлен админу {ADMIN_ID}")
        except Exception as e:
            print(f"{C_RED}[ERR]{C_END} Ошибка бэкапа: {e}")

# --- SCHEMAS ---
class SaveData(BaseModel):
    model_config = ConfigDict(extra="allow")
    user_id: str
    score: Optional[float] = 0.0
    click_lvl: Optional[float] = 1.0
    energy: Optional[float] = 1000.0
    max_energy: Optional[int] = 1000
    pnl: Optional[float] = 0.0

# --- DATABASE ---
async def init_db():
    print(f"{C_CYAN}{C_BOLD}[DATABASE]{C_END} Инициализация SQLite...")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, 
             click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000,
             max_energy INTEGER DEFAULT 1000,
             pnl REAL DEFAULT 0, last_active INTEGER DEFAULT 0,
             wallet TEXT, referrer_id TEXT, referrals_count INTEGER DEFAULT 0)''')
        try: await db.execute("ALTER TABLE users ADD COLUMN max_energy INTEGER DEFAULT 1000")
        except: pass
        await db.commit()
    print(f"{C_GREEN}{C_BOLD}[SUCCESS]{C_END} База данных готова к работе.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Запуск фонового бэкапа
    asyncio.create_task(backup_task())
    
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    print(f"{C_BLUE}{C_BOLD}[TELEGRAM]{C_END} Webhook активен: {webhook_url}")
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    if "/api/" in request.url.path or request.url.path == "/":
        print(f"{C_CYAN}[NET]{C_END} {request.method} {request.url.path} | {response.status_code} | {process_time:.2f}ms")
    return response

# --- API ENDPOINTS ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (str(user_id),)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            print(f"{C_YELLOW}[NEW_USER]{C_END} Регистрация ID: {user_id}")
            await db.execute("INSERT INTO users (id, balance, last_active, energy, max_energy) VALUES (?, 1000.0, ?, 1000.0, 1000)", 
                             (str(user_id), now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "energy": 1000, "max_energy": 1000, "pnl": 0}}

        u = dict(user)
        if u['pnl'] > 0 and u['last_active'] > 0:
            diff = now - u['last_active']
            earned = (min(diff, 28800) / 3600) * u['pnl']
            if earned > 0:
                print(f"{C_GREEN}[FARM]{C_END} Оффлайн доход: +{int(earned)} NP для {user_id}")
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", (u['balance'], now, str(user_id)))
                await db.commit()
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    try:
        print(f"{C_GREEN}{C_BOLD}[SAVE]{C_END} User: {data.user_id} | Score: {int(data.score)} | PnL: {data.pnl}")
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, last_active=? WHERE id=?", 
                (float(data.score or 0), int(data.click_lvl or 1), float(data.energy or 0), 
                 int(data.max_energy or 1000), float(data.pnl or 0), int(time.time()), str(data.user_id))
            )
            await db.commit()
        return {"status": "ok"}
    except Exception as e:
        print(f"{C_RED}[ERR]{C_END} Ошибка в save_game: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.get("/api/leaderboard")
async def get_leaderboard():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10") as cursor:
            rows = await cursor.fetchall()
            return {"status": "ok", "data": [dict(r) for r in rows]}

# --- BOT LOGIC ---

@dp.message(Command("start"))
async def cmd_start(m: types.Message, command: CommandObject):
    user_id = str(m.from_user.id)
    username = m.from_user.username or "Anon"
    args = command.args 
    
    print(f"{C_YELLOW}[BOT]{C_END} Команда /start от {user_id}")
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id = ?", (user_id,)) as cursor:
            exists = await cursor.fetchone()
        
        if not exists:
            ref_id = str(args) if args and str(args) != user_id else None
            await db.execute(
                "INSERT INTO users (id, balance, referrer_id, last_active, energy, max_energy) VALUES (?, 1000.0, ?, ?, 1000.0, 1000)", 
                (user_id, ref_id, int(time.time()))
            )
            if ref_id:
                print(f"{C_YELLOW}[REF]{C_END} Начисление реф-бонуса для {ref_id}")
                await db.execute("UPDATE users SET balance = balance + 50000, referrals_count = referrals_count + 1 WHERE id = ?", (ref_id,))
                try: await bot.send_message(ref_id, "<b>🎉 +50,000 NP!</b> Реферал присоединился.")
                except: pass
            await db.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))]
    ])
    await m.answer(f"<b>Neural Pulse Terminal.</b>\nСтатус: <code>ONLINE</code>\n\nДобро пожаловать, {username}.", reply_markup=kb)

@app.post("/webhook")
async def bot_webhook(request: Request):
    data = await request.json()
    update = Update.model_validate(data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

# --- STATIC ---
app.mount("/images", StaticFiles(directory=str(BASE_DIR / "images")), name="images")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

@app.get("/")
async def index():
    for p in [BASE_DIR / "index.html", BASE_DIR / "static" / "index.html"]:
        if p.exists(): return FileResponse(p)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

if __name__ == "__main__":
    print(f"{C_GREEN}{C_BOLD}[SYSTEM]{C_END} Neural Pulse Engine стартует на порту {os.environ.get('PORT', 3000)}...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 3000)))
