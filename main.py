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

# --- [STAGE 0] ИНИЦИАЛИЗАЦИЯ ЦВЕТОВ И ЛОГИРОВАНИЯ ---
C_GREEN = "\033[92m"
C_BLUE = "\033[94m"
C_YELLOW = "\033[93m"
C_RED = "\033[91m"
C_BOLD = "\033[1m"
C_CYAN = "\033[96m"
C_MAGENTA = "\033[95m"
C_WHITE = "\033[97m"
C_END = "\033[0m"

def log_step(category: str, message: str, color: str = C_WHITE):
    """Доскональное логирование для Bothost Terminal"""
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    # flush=True гарантирует появление строки в логах Bothost без задержек
    print(f"{C_BOLD}[{curr_time}]{C_END} {color}{category.ljust(12)}{C_END} | {message}", flush=True)

log_step("SYSTEM", "Запуск Neural Pulse Engine...", C_CYAN)

# --- CONFIG ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
ADMIN_ID = 476014374 
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"

# Отключаем лишний шум от сторонних библиотек
logging.basicConfig(level=logging.INFO, format='%(message)s')

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
    tasks_completed: Optional[str] = ""

# --- [STAGE 1] ПРОВЕРКА ОКРУЖЕНИЯ ---
log_step("FS", "Проверка папок статики...", C_CYAN)
for folder in ["static", "images"]:
    path = BASE_DIR / folder
    if not path.exists():
        path.mkdir(exist_ok=True)
        log_step("FS", f"Папка {folder} создана", C_YELLOW)
    else:
        log_step("FS", f"Папка {folder} в порядке", C_GREEN)

# --- [STAGE 2] BOT API ---
log_step("BOT", "Подключение к Telegram API...", C_CYAN)
try:
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    log_step("BOT", "Инстанс бота инициализирован", C_GREEN)
except Exception as e:
    log_step("BOT_ERR", str(e), C_RED)
    sys.exit(1)

# --- BACKUP SYSTEM ---
async def backup_task():
    log_step("TASK", "Модуль бэкапа запущен (интервал 24ч)", C_BLUE)
    while True:
        await asyncio.sleep(86400)
        try:
            if DB_PATH.exists():
                log_step("BACKUP", "Создание копии базы...", C_MAGENTA)
                file = FSInputFile(DB_PATH, filename=f"backup_{datetime.date.today()}.db")
                await bot.send_document(ADMIN_ID, file, caption=f"📦 #BACKUP {datetime.date.today()}")
                log_step("BACKUP", "Бэкап успешно доставлен", C_GREEN)
        except Exception as e:
            log_step("BACKUP_ERR", str(e), C_RED)

# --- [STAGE 3] DATABASE ---
async def init_db():
    log_step("DB", "Инициализация SQLite...", C_CYAN)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
             energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
             level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0,
             wallet TEXT DEFAULT NULL, referrer_id TEXT DEFAULT NULL, referrals_count INTEGER DEFAULT 0,
             ref_balance REAL DEFAULT 0, tasks_completed TEXT DEFAULT "")''')
        
        # Миграции
        cursor = await db.execute("PRAGMA table_info(users)")
        existing = [row[1] for row in await cursor.fetchall()]
        for col, spec in {"level": "INTEGER DEFAULT 1", "exp": "INTEGER DEFAULT 0", "wallet": "TEXT DEFAULT NULL"}.items():
            if col not in existing:
                log_step("DB_MIGRATE", f"Добавление колонки {col}", C_MAGENTA)
                await db.execute(f"ALTER TABLE users ADD COLUMN {col} {spec}")
        
        await db.commit()
        log_step("DB", "База данных готова", C_GREEN)

# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    log_step("LIFESPAN", "Точка входа: Запуск ресурсов", C_YELLOW)
    await init_db()
    asyncio.create_task(backup_task())
    
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    log_step("WEBHOOK", f"Установка вебхука на {webhook_url}", C_CYAN)
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    
    yield
    log_step("LIFESPAN", "Точка выхода: Завершение работы", C_RED)
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ENDPOINTS ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    log_step("API", f"GET BALANCE | User: {user_id}", C_BLUE)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (str(user_id),)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            log_step("DB", f"Регистрация нового игрока {user_id}", C_MAGENTA)
            await db.execute("INSERT INTO users (id, balance, last_active) VALUES (?, 1000, ?)", (user_id, now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "level": 1, "energy": 1000}}

        u = dict(user)
        if u['pnl'] > 0 and u['last_active'] > 0:
            earned = ((now - u['last_active']) / 3600) * u['pnl']
            if earned > 0:
                log_step("PnL", f"Начислено +{earned:.2f} (оффлайн) для {user_id}", C_GREEN)
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", (u['balance'], now, user_id))
                await db.commit()
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    log_step("API", f"SAVE DATA | User: {data.user_id} | Balance: {data.score}", C_CYAN)
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                """UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, 
                   level=?, exp=?, wallet=?, last_active=? WHERE id=?""", 
                (float(data.score), int(data.click_lvl), float(data.energy), 
                 int(data.max_energy), float(data.pnl), int(data.level), 
                 int(data.exp), data.wallet, int(time.time()), str(data.user_id))
            )
            await db.commit()
        return {"status": "ok"}
    except Exception as e:
        log_step("SAVE_ERR", str(e), C_RED)
        return JSONResponse({"status": "error"}, status_code=400)

@app.post("/webhook")
async def bot_webhook(request: Request):
    data = await request.json()
    log_step("TG_WEBHOOK", "Получен входящий апдейт", C_WHITE)
    update = Update.model_validate(data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}

# --- BOT HANDLERS ---
@dp.message(Command("start"))
async def cmd_start(m: types.Message, command: CommandObject):
    user_id = str(m.from_user.id)
    log_step("TG_MSG", f"Команда /start от {user_id}", C_YELLOW)
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id = ?", (user_id,)) as cursor:
            if not await cursor.fetchone():
                ref_id = str(command.args) if command.args and str(command.args) != user_id else None
                log_step("DB", f"Новый юзер в базе: {user_id}", C_MAGENTA)
                await db.execute("INSERT INTO users (id, balance, referrer_id, last_active) VALUES (?, 1000, ?, ?)", 
                                 (user_id, ref_id, int(time.time())))
                if ref_id:
                    await db.execute("UPDATE users SET balance=balance+50000 WHERE id=?", (ref_id,))
                    log_step("REF", f"Реферальный бонус для {ref_id}", C_GREEN)
                await db.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))]
    ])
    await m.answer(f"<b>Neural Pulse Online</b>\n\nДобро пожаловать в систему.", reply_markup=kb)

# --- STATIC ---
app.mount("/images", StaticFiles(directory=str(BASE_DIR / "images")), name="images")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

@app.get("/")
async def index():
    log_step("WEB", "Загрузка index.html", C_WHITE)
    return FileResponse(BASE_DIR / "index.html")

# --- START ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    log_step("SERVER", f"Запуск Uvicorn на порту {port}", C_BOLD + C_GREEN)
    uvicorn.run(app, host="0.0.0.0", port=port, access_log=False)
