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

# --- РАСШИРЕННАЯ ПАЛИТРА ЦВЕТОВ ДЛЯ ЛОГОВ ---
C_GREEN = "\033[92m"
C_BLUE = "\033[94m"
C_YELLOW = "\033[93m"
C_RED = "\033[91m"
C_BOLD = "\033[1m"
C_CYAN = "\033[96m"
C_MAGENTA = "\033[95m"
C_END = "\033[0m"

# --- CONFIG ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
ADMIN_ID = 476014374 
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"

# Отключаем стандартный логгер uvicorn для чистоты наших логов
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("NeuralPulse")

# --- МОДЕЛЬ ДАННЫХ (Pydantic) ---
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

# --- Вспомогательная функция логирования ---
def log_step(category: str, message: str, color: str = C_WHITE):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C_BOLD}[{curr_time}]{C_END} {color}{category.ljust(12)}{C_END} | {message}")

C_WHITE = "\033[97m"

# --- STAGE 1: ПРОВЕРКА ФАЙЛОВОЙ СИСТЕМЫ ---
log_step("SYSTEM", "Проверка структуры папок...", C_CYAN)
for folder in ["static", "images"]:
    path = BASE_DIR / folder
    if not path.exists():
        path.mkdir(exist_ok=True)
        log_step("FS", f"Создана недостающая папка: {folder}", C_YELLOW)
    else:
        log_step("FS", f"Папка {folder} подтверждена", C_GREEN)

# --- STAGE 2: ИНИЦИАЛИЗАЦИЯ BOT API ---
log_step("SYSTEM", "Инициализация Bot API...", C_CYAN)
try:
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    log_step("BOT", "Объект Bot и Dispatcher готовы", C_GREEN)
except Exception as e:
    log_step("CRITICAL", f"Ошибка Bot API: {e}", C_RED)
    sys.exit(1)

# --- BACKUP SYSTEM ---
async def backup_task():
    log_step("BACKUP", "Фоновый процесс бэкапа активирован", C_BLUE)
    while True:
        await asyncio.sleep(86400) # 24 часа
        try:
            if DB_PATH.exists():
                log_step("BACKUP", "Создание ежедневного дампа базы...", C_MAGENTA)
                file = FSInputFile(DB_PATH, filename=f"backup_{datetime.date.today()}.db")
                await bot.send_document(ADMIN_ID, file, caption="📦 #BACKUP | Auto-save")
                log_step("BACKUP", "Файл отправлен администратору", C_GREEN)
        except Exception as e:
            log_step("BACKUP_ERR", str(e), C_RED)

# --- STAGE 3: DATABASE И МИГРАЦИИ ---
async def init_db():
    log_step("DB", "Подключение к SQLite...", C_CYAN)
    async with aiosqlite.connect(DB_PATH) as db:
        log_step("DB", "Включение режима WAL (оптимизация записи)", C_YELLOW)
        await db.execute("PRAGMA journal_mode=WAL")
        
        log_step("DB", "Проверка/создание таблицы users...", C_YELLOW)
        await db.execute('''CREATE TABLE IF NOT EXISTS users 
            (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
             energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
             level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0,
             wallet TEXT DEFAULT NULL, referrer_id TEXT DEFAULT NULL, referrals_count INTEGER DEFAULT 0,
             ref_balance REAL DEFAULT 0, tasks_completed TEXT DEFAULT "")''')
        
        # Динамическая миграция колонок
        cursor = await db.execute("PRAGMA table_info(users)")
        existing_cols = [row[1] for row in await cursor.fetchall()]
        needed_cols = {"level": "INTEGER DEFAULT 1", "exp": "INTEGER DEFAULT 0", "wallet": "TEXT DEFAULT NULL"}
        
        for col, spec in needed_cols.items():
            if col not in existing_cols:
                log_step("DB_MIGRATE", f"Добавление колонки {col}...", C_MAGENTA)
                await db.execute(f"ALTER TABLE users ADD COLUMN {col} {spec}")
        
        await db.commit()
        log_step("DB", "База данных полностью инициализирована", C_GREEN)

# --- LIFESPAN (Запуск и Остановка) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    log_step("LIFESPAN", "Запуск Neural Pulse Terminal...", C_CYAN)
    await init_db()
    asyncio.create_task(backup_task())
    
    log_step("WEBHOOK", f"Установка связи с Telegram...", C_YELLOW)
    webhook_url = f"https://{MY_DOMAIN}/webhook"
    await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
    log_step("WEBHOOK", f"URL: {webhook_url}", C_GREEN)
    
    yield
    log_step("SYSTEM", "Завершение работы сессий...", C_RED)
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

# CORS (для работы WebApp)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- API ENDPOINTS С ЛОГИРОВАНИЕМ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    log_step("API_GET", f"Запрос баланса: {user_id}", C_BLUE)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (str(user_id),)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            log_step("DB_REG", f"Новый пользователь: {user_id}", C_MAGENTA)
            await db.execute("INSERT INTO users (id, balance, last_active) VALUES (?, 1000, ?)", (user_id, now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "level": 1}}

        u = dict(user)
        # Оффлайн доход
        if u['pnl'] > 0 and u['last_active'] > 0:
            diff = now - u['last_active']
            earned = (min(diff, 28800) / 3600) * u['pnl']
            if earned > 0:
                log_step("PnL", f"Начислено {earned:.2f} за {diff}с оффлайна для {user_id}", C_GREEN)
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", (u['balance'], now, user_id))
                await db.commit()
        
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    log_step("API_SAVE", f"Синхронизация данных для {data.user_id}", C_CYAN)
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
            log_step("DB_OK", f"Прогресс {data.user_id} сохранен (Баланс: {data.score})", C_GREEN)
        return {"status": "ok"}
    except Exception as e:
        log_step("DB_ERR", f"Ошибка сохранения: {e}", C_RED)
        return JSONResponse({"status": "error"}, status_code=400)

@app.post("/webhook")
async def bot_webhook(request: Request):
    # Логируем входящий апдейт от телеграма (опционально очень детально)
    data = await request.json()
    update = Update.model_validate(data, context={"bot": bot})
    log_step("TG_UPDATE", f"Апдейт ID: {update.update_id}", C_WHITE)
    await dp.feed_update(bot, update)
    return {"ok": True}

# --- TG HANDLERS ---
@dp.message(Command("start"))
async def cmd_start(m: types.Message, command: CommandObject):
    user_id = str(m.from_user.id)
    log_step("TG_CMD", f"/start от {user_id} (args: {command.args})", C_YELLOW)
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM users WHERE id = ?", (user_id,)) as cursor:
            if not await cursor.fetchone():
                ref_id = str(command.args) if command.args and str(command.args) != user_id else None
                log_step("REG", f"Создание записи {user_id}. Реферер: {ref_id}", C_MAGENTA)
                await db.execute("INSERT INTO users (id, balance, referrer_id, last_active) VALUES (?, 1000, ?, ?)", 
                                 (user_id, ref_id, int(time.time())))
                if ref_id:
                    await db.execute("UPDATE users SET balance=balance+50000 WHERE id=?", (ref_id,))
                    log_step("REF", f"Бонус +50к начислен {ref_id}", C_GREEN)
                await db.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))]
    ])
    await m.answer(f"<b>Neural Pulse Terminal</b>\n\nСистема готова, @{m.from_user.username}. Начинай майнинг.", reply_markup=kb)

# --- STATIC ---
app.mount("/images", StaticFiles(directory=str(BASE_DIR / "images")), name="images")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

@app.get("/")
async def index():
    log_step("WEB", "Загрузка основной страницы index.html", C_WHITE)
    return FileResponse(BASE_DIR / "index.html")

# --- START SERVER ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    log_step("SYSTEM", f"Запуск сервера на порту {port}...", C_BOLD + C_GREEN)
    uvicorn.run(app, host="0.0.0.0", port=port, access_log=False)
