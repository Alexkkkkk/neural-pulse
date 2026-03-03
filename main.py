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

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger("uvicorn.error")

# --- INITIALIZATION LOGS ---
print(f"{C_CYAN}[STAGE 1] Проверка окружения...{C_END}")
for folder in ["static", "images"]:
    path = BASE_DIR / folder
    if not path.exists():
        path.mkdir(exist_ok=True)
        print(f" > Папка {folder} создана.")

# --- BOT INIT ---
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

# --- DATABASE ---
async def init_db():
    print(f"{C_CYAN}[STAGE 3] Работа с базой данных...{C_END}")
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("PRAGMA journal_mode=WAL")
            print(" > Режим WAL активирован.")
            await db.execute('''CREATE TABLE IF NOT EXISTS users 
                (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, 
                 click_lvl INTEGER DEFAULT 1, energy REAL DEFAULT 1000,
                 max_energy INTEGER DEFAULT 1000,
                 pnl REAL DEFAULT 0, last_active INTEGER DEFAULT 0,
                 wallet TEXT, referrer_id TEXT, referrals_count INTEGER DEFAULT 0)''')
            
            # Миграция (проверка наличия колонки)
            cursor = await db.execute("PRAGMA table_info(users)")
            cols = [row[1] for row in await cursor.fetchall()]
            if 'max_energy' not in cols:
                await db.execute("ALTER TABLE users ADD COLUMN max_energy INTEGER DEFAULT 1000")
                print(" > Миграция: Добавлена колонка max_energy.")
            
            await db.commit()
            print(f"{C_GREEN} > База данных SQLite готова к запросам.{C_END}")
    except Exception as e:
        print(f"{C_RED} > ОШИБКА БАЗЫ ДАННЫХ: {e}{C_END}")
        raise

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"{C_YELLOW}[LIFESPAN] Точка входа: инициализация ресурсов...{C_END}")
    await init_db()
    
    # Запуск фонового процесса
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
    print(f"{C_YELLOW}[LIFESPAN] Точка выхода: закрытие сессий...{C_END}")
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
    print(f"{C_BLUE}[IN] {request.method} {path}{C_END}")
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        print(f"{C_CYAN}[OUT] {path} | Status: {response.status_code} | Time: {process_time:.2f}ms{C_END}")
        return response
    except Exception as e:
        print(f"{C_RED}[RUNTIME ERR] Ошибка при обработке {path}: {e}{C_END}")
        return JSONResponse({"error": "Internal Server Error"}, status_code=500)

# --- API ENDPOINTS ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    print(f" > DB_REQ: Запрос профиля для {user_id}")
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (str(user_id),)) as cursor:
            user = await cursor.fetchone()
        
        now = int(time.time())
        if not user:
            print(f" > DB_REG: Регистрация нового игрока {user_id}")
            await db.execute("INSERT INTO users (id, balance, last_active, energy, max_energy) VALUES (?, 1000.0, ?, 1000.0, 1000)", 
                             (str(user_id), now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1, "energy": 1000, "max_energy": 1000, "pnl": 0}}

        u = dict(user)
        # Обработка PnL (оффлайн доход)
        if u['pnl'] > 0 and u['last_active'] > 0:
            diff = now - u['last_active']
            earned = (min(diff, 28800) / 3600) * u['pnl']
            if earned > 0:
                print(f" > PnL: Начислено {earned:.2f} монет за {diff} сек. отсутствия.")
                u['balance'] += earned
                await db.execute("UPDATE users SET balance=?, last_active=? WHERE id=?", (u['balance'], now, str(user_id)))
                await db.commit()
        return {"status": "ok", "data": u}

@app.post("/api/save")
async def save_game(data: SaveData):
    print(f" > DB_SAVE: Синхронизация данных юзера {data.user_id}")
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, last_active=? WHERE id=?", 
                (float(data.score or 0), int(data.click_lvl or 1), float(data.energy or 0), 
                 int(data.max_energy or 1000), float(data.pnl or 0), int(time.time()), str(data.user_id))
            )
            await db.commit()
        return {"status": "ok"}
    except Exception as e:
        print(f"{C_RED} > DB_SAVE_ERR: Ошибка записи {data.user_id}: {e}{C_END}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception as e:
        print(f"{C_RED}[WEBHOOK ERR] Сбой входящего апдейта: {e}{C_END}")
        return {"ok": False}

@app.get("/")
async def index():
    print(f" > WEB: Попытка загрузки index.html")
    # Проверяем файлы в обеих возможных папках
    paths = [BASE_DIR / "index.html", BASE_DIR / "static" / "index.html"]
    for p in paths:
        if p.exists():
            print(f" > WEB: Файл найден в {p}")
            return FileResponse(p)
    
    print(f"{C_RED} > WEB ERR: Файл index.html НЕ НАЙДЕН в {BASE_DIR}{C_END}")
    return JSONResponse({"error": "Interface file missing"}, status_code=404)

# --- EXECUTION ---
if __name__ == "__main__":
    try:
        port = int(os.environ.get("PORT", 3000))
        print(f"{C_GREEN}{C_BOLD}[START] Запуск Uvicorn-сервера на порту {port}...{C_END}")
        uvicorn.run(app, host="0.0.0.0", port=port, access_log=False)
    except Exception as fatal_e:
        print(f"{C_RED}[FATAL ERROR] Сервер не смог стартовать: {fatal_e}{C_END}")
