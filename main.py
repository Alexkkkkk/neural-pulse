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

# --- ANSI ЦВЕТА ДЛЯ ЛОГОВ ---
C_GREEN = "\033[92m"
C_BLUE = "\033[94m"
C_YELLOW = "\033[93m"
C_RED = "\033[91m"
C_BOLD = "\033[1m"
C_CYAN = "\033[96m"
C_END = "\033[0m"

# --- CONFIG ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
ADMIN_ID = 476014374 
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

# --- SCHEMAS (SaveData - Модель для тапалки) ---
class SaveData(BaseModel):
    model_config = ConfigDict(extra="allow")
    user_id: str
    score: Optional[float] = 0.0          # Баланс
    click_lvl: Optional[int] = 1          # Сила клика
    energy: Optional[float] = 1000.0      # Энергия
    max_energy: Optional[int] = 1000      # Лимит энергии
    pnl: Optional[float] = 0.0            # Прибыль в час
    level: Optional[int] = 1              # Уровень игрока
    exp: Optional[int] = 0                # Опыт
    wallet: Optional[str] = None          # Кошелек
    tasks_completed: Optional[str] = ""   # Список выполненных задач

# --- STAGE 1: FILESYSTEM ---
print(f"{C_CYAN}[STAGE 1] Проверка окружения...{C_END}")
for folder in ["static", "images"]:
    path = BASE_DIR / folder
    if not path.exists():
        path.mkdir(exist_ok=True)
        print(f" > Папка {folder} создана.")

# --- STAGE 2: BOT API ---
print(f"{C_CYAN}[STAGE 2] Подключение Bot API...{C_END}")
try:
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    print(f"{C_GREEN} > Объект Bot успешно инициализирован.{C_END}")
except Exception as e:
    print(f"{C_RED} > КРИТИЧЕСКАЯ ОШИБКА BOT API: {e}{C_END}")

# --- BACKUP SYSTEM ---
async def backup_task():
    print(f"{C_BLUE}[TASK] Модуль бэкапа запущен и ожидает...{C_END}")
    while True:
        await asyncio.sleep(86400) # 24 часа
        try:
            if DB_PATH.exists():
                print(f"{C_CYAN}[BACKUP] Начинаю процедуру копирования...{C_END}")
                file = FSInputFile(DB_PATH, filename=f"backup_{datetime.date.today()}.db")
                await bot.send_document(ADMIN_ID, file, caption=f"📦 #BACKUP\nАвтоматическая копия базы.")
                print(f"{C_GREEN}[BACKUP] Файл успешно отправлен админу {ADMIN_ID}.{C_END}")
        except Exception as e:
            print(f"{C_RED}[BACKUP ERR] Не удалось выполнить бэкап: {e}{C_END}")

# --- STAGE 3: DATABASE (Extended) ---
async def init_db():
    print(f"{C_CYAN}[STAGE 3] Работа с базой данных...{C_END}")
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("PRAGMA journal_mode=WAL")
            
            # Создаем таблицу со всеми параметрами тапалки
            await db.execute('''CREATE TABLE IF NOT EXISTS users 
                (id TEXT PRIMARY KEY, 
                 balance REAL DEFAULT 1000, 
                 click_lvl INTEGER DEFAULT 1, 
                 energy REAL DEFAULT 1000,
                 max_energy INTEGER DEFAULT 1000,
                 pnl REAL DEFAULT 0, 
                 level INTEGER DEFAULT 1,
                 exp INTEGER DEFAULT 0,
                 last_active INTEGER DEFAULT 0,
                 wallet TEXT DEFAULT NULL, 
                 referrer_id TEXT DEFAULT NULL, 
                 referrals_count INTEGER DEFAULT 0,
                 ref_balance REAL DEFAULT 0,
                 tasks_completed TEXT DEFAULT "")''')
            
            # Проверка наличия колонок (Миграция)
            cursor = await db.execute("PRAGMA table_info(users)")
            existing_cols = [row[1] for row in await cursor.fetchall()]
            
            needed_cols = {
                "level": "INTEGER DEFAULT 1",
                "exp": "INTEGER DEFAULT 0",
                "ref_balance": "REAL DEFAULT 0",
                "tasks_completed": "TEXT DEFAULT ''",
                "wallet": "TEXT DEFAULT NULL"
            }
            
            for col, spec in needed_cols.items():
                if col not in existing_cols:
                    await db.execute(f"ALTER TABLE users ADD COLUMN {col} {spec}")
                    print(f" > Миграция: Добавлена колонка {col}")
            
            await db.commit()
            print(f"{C_GREEN} > База данных готова к масштабированию.{C_END}")
    except Exception as e:
        print(f"{C_RED} > ОШИБКА БАЗЫ ДАННЫХ: {e}{C_END}")
        raise

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"{C_YELLOW}[LIFESPAN] Точка входа: инициализация ресурсов...{C_END}")
    await init_db()
    asyncio.create_task(backup_task())
    
    print(f"{C_CYAN}[STAGE 4] Настройка Webhook...{C_END}")
    try:
        webhook_url = f"https://{MY_DOMAIN}/webhook"
        await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
        print(f"{C_GREEN} > Webhook установлен успешно: {webhook_url}{C_END}")
    except Exception as e:
        print(f"{C_RED} > ОШИБКА ВЕБХУКА: {e}{C_END}")
        
    print(f"{C_GREEN}{C_BOLD}[READY] Neural Pulse Terminal полностью запущен.{C_END}")
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
    path = request.url.path
    try:
        response = await call_next(request)
        if "/api/" in path or path == "/":
            process_time = (time.time() - start_time) * 1000
            print(f"{C_CYAN}[NET]{C_END} {request.method} {path} | {response.status_code} | {process_time:.2f}ms")
        return response
    except Exception as e:
        print(f"{C_RED}[RUNTIME ERR] {path}: {e}{C_END}")
        return JSONResponse({"error": "Internal Server Error"}, status_code=500)

# --- API ENDPOINTS ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (str(user_id),)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            print(f" > DB_REG: Регистрация {user_id}")
            await db.execute("INSERT INTO users (id, balance, last_active, energy, max_energy) VALUES (?, 1000.0, ?, 1000.0, 1000)", 
                             (str(user_id), now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "level": 1, "energy": 1000}}

        u = dict(user)
        # Оффлайн доход (PnL)
        if u['pnl'] > 0 and u['last_active'] > 0:
            diff = now - u['last_active']
            earned = (min(diff, 28800) / 3600) * u['pnl']
            if earned > 0:
                print(f" > PnL: +{earned:.2f} для {user_id}")
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", (u['balance'], now, str(user_id)))
                await db.commit()
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    print(f" > DB_SAVE: {data.user_id}")
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                """UPDATE users SET 
                   balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, 
                   level=?, exp=?, wallet=?, tasks_completed=?, last_active=? 
                   WHERE id=?""", 
                (float(data.score or 0), int(data.click_lvl or 1), float(data.energy or 0), 
                 int(data.max_energy or 1000), float(data.pnl or 0), int(data.level or 1),
                 int(data.exp or 0), data.wallet, data.tasks_completed, int(time.time()), str(data.user_id))
            )
            await db.commit()
        return {"status": "ok"}
    except Exception as e:
        print(f"{C_RED} > DB_SAVE_ERR: {e}{C_END}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.post("/webhook")
async def bot_webhook(request: Request):
    data = await request.json()
    update = Update.model_validate(data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

# --- TELEGRAM BOT HANDLERS ---
@dp.message(Command("start"))
async def cmd_start(m: types.Message, command: CommandObject):
    user_id = str(m.from_user.id)
    username = m.from_user.username or "User"
    args = command.args
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id = ?", (user_id,)) as cursor:
            exists = await cursor.fetchone()
        
        if not exists:
            ref_id = str(args) if args and str(args) != user_id else None
            await db.execute("INSERT INTO users (id, balance, referrer_id, last_active) VALUES (?, 1000, ?, ?)", 
                             (user_id, ref_id, int(time.time())))
            if ref_id:
                await db.execute("UPDATE users SET balance=balance+50000, referrals_count=referrals_count+1 WHERE id=?", (ref_id,))
                try: await bot.send_message(ref_id, "<b>🎉 +50k NP!</b> По твоей ссылке зашел новый игрок.")
                except: pass
            await db.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))]
    ])
    await m.answer(f"<b>Neural Pulse Engine</b>\n\nДобро пожаловать в терминал, {username}.", reply_markup=kb)

# --- STATIC FILES ---
app.mount("/images", StaticFiles(directory=str(BASE_DIR / "images")), name="images")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

@app.get("/")
async def index():
    paths = [BASE_DIR / "index.html", BASE_DIR / "static" / "index.html"]
    for p in paths:
        if p.exists(): return FileResponse(p)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

# --- EXECUTION ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    print(f"{C_GREEN}[START] Сервер запущен на порту {port}{C_END}")
    uvicorn.run(app, host="0.0.0.0", port=port, access_log=False)
