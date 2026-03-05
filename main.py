import os, asyncio, logging, time, datetime, sys
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandObject, Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- [НАСТРОЙКА ЛОГИРОВАНИЯ] ---
# Настраиваем формат: Время | Уровень | Сообщение
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NeuralPulse")

# --- [КОНФИГУРАЦИЯ] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"
API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM"

logger.info(f"Запуск инициализации. Базовая директория: {BASE_DIR}")

# Кэш в оперативной памяти (самая быстрая часть системы)
USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

# --- [МОДЕЛИ] ---
class SaveData(BaseModel):
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int

# --- [ЛОГИКА БАЗЫ ДАННЫХ] ---
async def batch_db_update():
    """ Пакетное сохранение данных из кэша в БД каждые 15 секунд """
    logger.info("Фоновая задача BATCH_SYNC запущена.")
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn:
            continue
        
        try:
            start_time = time.perf_counter()
            users_to_update = []
            
            # Собираем данные из кэша
            for uid, entry in list(USER_CACHE.items()):
                d = entry.get("data")
                if not d: continue
                users_to_update.append((
                    str(uid), float(d['score']), int(d['click_lvl']), 
                    float(d['energy']), int(d['max_energy']), 
                    float(d['pnl']), int(d['level']), int(time.time())
                ))

            if users_to_update:
                logger.info(f"Начало записи пакета: {len(users_to_update)} пользователей.")
                
                # Массовая запись в SQLite
                await db_conn.executemany("""
                    INSERT INTO users (id, balance, click_lvl, energy, max_energy, pnl, level, last_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance,
                        click_lvl=excluded.click_lvl,
                        energy=excluded.energy,
                        max_energy=excluded.max_energy,
                        pnl=excluded.pnl,
                        level=excluded.level,
                        last_active=excluded.last_active
                """, users_to_update)
                await db_conn.commit()
                
                duration = time.perf_counter() - start_time
                logger.info(f"Успешная синхронизация {len(users_to_update)} чел. за {duration:.4f} сек.")
            
        except Exception as e:
            logger.error(f"Критическая ошибка синхронизации БД: {e}", exc_info=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """ Управление жизненным циклом приложения """
    global db_conn
    
    # 1. Подключение к БД
    logger.info(f"Подключение к SQLite: {DB_PATH}")
    db_conn = await aiosqlite.connect(DB_PATH)
    
    # 2. Тюнинг БД для скорости (миллионы юзеров)
    logger.info("Настройка PRAGMA (WAL mode, Normal sync)")
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=NORMAL")
    
    # 3. Проверка таблицы
    logger.info("Проверка структуры таблиц...")
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
            energy REAL, max_energy INTEGER, pnl REAL, 
            level INTEGER, last_active INTEGER
        )
    """)
    await db_conn.commit()
    
    # 4. Запуск бота
    logger.info("Инициализация Telegram Bot...")
    bot = Bot(token=API_TOKEN)
    dp = Dispatcher()
    
    @dp.message(Command("start"))
    async def start(m: types.Message):
        logger.info(f"Команда /start от юзера: {m.from_user.id}")
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="Запустить Neural Pulse 🚀", web_app=WebAppInfo(url="https://np.bothost.ru/"))
        ]])
        await m.answer("<b>Neural Pulse Online</b>\nДобро пожаловать в сеть!", reply_markup=kb, parse_mode="HTML")

    # 5. Запуск фоновых задач
    logger.info("Запуск Long Polling и фоновой синхронизации.")
    asyncio.create_task(dp.start_polling(bot))
    asyncio.create_task(batch_db_update())
    
    yield
    
    # 6. Завершение работы
    logger.info("Закрытие соединения с БД...")
    if db_conn:
        await db_conn.close()

# --- [FASTAPI ПРИЛОЖЕНИЕ] ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    uid = str(user_id)
    
    # Проверка кэша
    if uid in USER_CACHE:
        logger.info(f"API: Баланс {uid} взят из кэша.")
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    # Поиск в БД
    logger.info(f"API: Запрос баланса {uid} из БД.")
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance") # Для фронтенда
        USER_CACHE[uid] = {"data": data}
        logger.info(f"API: Юзер {uid} загружен в кэш.")
        return {"status": "ok", "data": data}
    
    # Если юзер новый
    logger.info(f"API: Создан новый профиль для {uid}.")
    new_data = {"score": 1000.0, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1}
    USER_CACHE[uid] = {"data": new_data}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    # Обновляем только кэш (память). БД обновится фоново.
    USER_CACHE[data.user_id] = {"data": data.model_dump()}
    # Логируем только важные изменения или раз в какое-то время, чтобы не забивать консоль
    # logger.debug(f"Кэш обновлен для {data.user_id}") 
    return {"status": "ok"}

@app.get("/api/jackpot")
async def jackpot():
    return {"status": "ok", "value": 777000}

# Раздача статики
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    logger.info("Доступ к главной странице (index.html)")
    return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    logger.info("Запуск сервера Uvicorn на порту 3000")
    uvicorn.run(app, host="0.0.0.0", port=3000)
