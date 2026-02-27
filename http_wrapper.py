import os, asyncio, sqlite3, uvicorn, logging, time, sys
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup

# Безопасный импорт Google Drive
try:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    from google.oauth2.credentials import Credentials
    HAS_GOOGLE_LIBS = True
except ImportError:
    HAS_GOOGLE_LIBS = False

# --- НАСТРОЙКА ЛОГИРОВАНИЯ ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("NEURAL_PULSE")

# --- КОНФИГУРАЦИЯ ---
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "game.db"

# Справочник уровней (все 20 уровней сохранены)
PLAYER_LEVELS = {
    1: {"name": "Новичок", "price": 0, "tap": 1},
    2: {"name": "Стажер", "price": 1000, "tap": 5},
    3: {"name": "Фрилансер", "price": 5000, "tap": 15},
    4: {"name": "Специалист", "price": 15000, "tap": 40},
    5: {"name": "Менеджер", "price": 45000, "tap": 100},
    6: {"name": "Тимлид", "price": 120000, "tap": 250},
    7: {"name": "Инвестор", "price": 350000, "tap": 600},
    8: {"name": "Миллионер", "price": 1000000, "tap": 1500},
    9: {"name": "Владелец ТГ", "price": 2500000, "tap": 4000},
    10: {"name": "CEO", "price": 6000000, "tap": 10000},
    11: {"name": "Магнат", "price": 15000000, "tap": 25000},
    12: {"name": "Крипто-Кит", "price": 40000000, "tap": 60000},
    13: {"name": "Мировой Игрок", "price": 100000000, "tap": 150000},
    14: {"name": "Теневой Лидер", "price": 250000000, "tap": 400000},
    15: {"name": "Хозяин Биржи", "price": 700000000, "tap": 1000000},
    16: {"name": "Олигарх", "price": 2000000000, "tap": 2500000},
    17: {"name": "Пророк ИИ", "price": 5000000000, "tap": 6000000},
    18: {"name": "Колонизатор", "price": 12000000000, "tap": 15000000},
    19: {"name": "Архитектор", "price": 35000000000, "tap": 40000000},
    20: {"name": "GOD MODE", "price": 100000000000, "tap": 100000000}
}

BOT_UPGRADE_COSTS = {
    0: {"price": 25000, "mult": 1},
    1: {"price": 100000, "mult": 3},
    2: {"price": 500000, "mult": 8},
    3: {"price": 2000000, "mult": 20},
    4: {"price": 10000000, "mult": 50}
}

TOKEN = "8257287930:AAFhDcKz-ebfaAHzb5H4Hr1b9SCa9OrSauI"
MY_DOMAIN = "ai.bothost.ru"

bot = Bot(token=TOKEN)
dp = Dispatcher()

# --- ФОНОВЫЕ ЗАДАЧИ ---

async def backup_to_gdrive():
    """Бэкап в облако раз в сутки"""
    while True:
        if HAS_GOOGLE_LIBS and os.path.exists('token.json'):
            try:
                creds = Credentials.from_authorized_user_file('token.json')
                service = build('drive', 'v3', credentials=creds)
                media = MediaFileUpload(str(DB_PATH), mimetype='application/x-sqlite3')
                service.files().create(
                    body={'name': f'backup_{datetime.now():%Y%m%d_%H%M}.db'},
                    media_body=media
                ).execute()
                logger.info("✅ [BACKUP] База данных успешно сохранена в Google Drive")
            except Exception as e:
                logger.error(f"❌ [BACKUP ERROR] {e}")
        await asyncio.sleep(86400)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("--- [ ENGINE STARTING ] ---")
    
    # Инициализация базы данных
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users 
                        (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                         click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
                         last_collect INTEGER DEFAULT 0, referrer_id TEXT,
                         last_bonus INTEGER DEFAULT 0)''')
        
        # Миграция: Проверка и добавление недостающих колонок
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'last_bonus' not in columns:
            try:
                conn.execute("ALTER TABLE users ADD COLUMN last_bonus INTEGER DEFAULT 0")
                logger.info("💾 Migration: Added 'last_bonus' column")
            except Exception as e:
                logger.error(f"Migration error: {e}")
        conn.commit()

    bot_task = asyncio.create_task(dp.start_polling(bot))
    back_task = asyncio.create_task(backup_to_gdrive())
    
    yield
    
    bot_task.cancel()
    back_task.cancel()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=str(STATIC_DIR))

# --- API ЭНДПОИНТЫ ---

@app.get("/")
async def serve_game(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT balance, click_lvl, bot_lvl, last_collect FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        
        if not row:
            conn.execute("INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect) VALUES (?, 1000, 1, 0, ?)", (user_id, now))
            conn.commit()
            return {"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "offline_profit": 0}
        
        balance, click_lvl, bot_lvl, last_collect = row
        offline_profit = 0
        
        # Расчет офлайн дохода
        if bot_lvl > 0 and last_collect > 0:
            seconds_passed = min(now - last_collect, 28800)  # Лимит 8 часов
            tap_power = PLAYER_LEVELS.get(click_lvl, PLAYER_LEVELS[1])["tap"]
            mult = BOT_UPGRADE_COSTS.get(bot_lvl - 1, {"mult": 1})["mult"]
            offline_profit = int(seconds_passed * (tap_power * mult / 10))
            balance += offline_profit

        conn.execute("UPDATE users SET balance = ?, last_collect = ? WHERE id = ?", (balance, now, user_id))
        conn.commit()
        return {"balance": balance, "click_lvl": click_lvl, "bot_lvl": bot_lvl, "offline_profit": offline_profit}

@app.post("/api/clicks")
async def save_clicks(data: dict = Body(...)):
    uid, clicks = str(data.get("user_id")), int(data.get("clicks", 0))
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("UPDATE users SET balance = balance + ?, last_collect = ? WHERE id = ?", (clicks, int(time.time()), uid))
        conn.commit()
    return {"status": "ok"}

@app.get("/api/leaderboard")
async def get_leaderboard():
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT id, balance, click_lvl FROM users ORDER BY balance DESC LIMIT 10")
        rows = c.fetchall()
        # Маскируем ID пользователя для безопасности
        leaders = [{"id": f"ID{r[0][:4]}****", "balance": r[1], "level": PLAYER_LEVELS.get(r[2], {"name":"???"})["name"]} for r in rows]
        return {"leaders": leaders}

@app.post("/api/daily_bonus")
async def claim_daily_bonus(data: dict = Body(...)):
    uid, now = str(data.get("user_id")), int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT last_bonus FROM users WHERE id = ?", (uid,))
        res = c.fetchone()
        
        if res and res[0] is not None and (now - res[0] < 86400):
            wait_time = 86400 - (now - res[0])
            return {"error": f"Бонус доступен через {wait_time // 3600}ч"}
            
        conn.execute("UPDATE users SET balance = balance + 5000, last_bonus = ? WHERE id = ?", (now, uid))
        conn.commit()
        return {"status": "ok", "bonus": 5000}

@app.get("/api/all_stats")
async def get_all_stats():
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        players = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        wealth = c.execute("SELECT SUM(balance) FROM users").fetchone()[0] or 0
        return {"total_players": players, "total_balance": wealth}

# --- БОТ ХЕНДЛЕРЫ ---

@dp.message(F.text.startswith("/start"))
async def start_handler(message: types.Message):
    uid = str(message.from_user.id)
    args = message.text.split()
    
    with sqlite3.connect(str(DB_PATH)) as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE id = ?", (uid,))
        if not c.fetchone():
            ref_id = args[1] if len(args) > 1 and args[1] != uid else None
            conn.execute("INSERT INTO users (id, balance, last_collect, referrer_id) VALUES (?, 1000, ?, ?)", 
                         (uid, int(time.time()), ref_id))
            if ref_id:
                # Награда за реферала
                conn.execute("UPDATE users SET balance = balance + 50000 WHERE id = ?", (ref_id,))
                try:
                    await bot.send_message(ref_id, "💎 Твой друг присоединился! Тебе начислено +50,000 NP!")
                except:
                    pass
            conn.commit()

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await message.answer(f"Привет, {message.from_user.first_name}! 🚀\nГотов добывать NP? Запускай приложение и начни путь к GOD MODE!", reply_markup=kb)

if __name__ == "__main__":
    # Запуск сервера
    uvicorn.run(app, host="0.0.0.0", port=3000)
