import os, asyncio, logging, time, datetime, sys
import aiosqlite
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update

# --- [ЛОГИРОВАНИЕ] ---
# Настройка красивого вывода в консоль Bothost
C_GREEN = "\033[92m"
C_YELLOW = "\033[93m"
C_RED = "\033[91m"
C_CYAN = "\033[96m"
C_MAGENTA = "\033[95m"
C_BOLD = "\033[1m"
C_END = "\033[0m"

def log_step(category: str, message: str, color: str = C_GREEN):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C_BOLD}[{curr_time}]{C_END} {color}{category.ljust(12)}{C_END} | {message}", flush=True)

# --- [STAGE 1] ИНИЦИАЛИЗАЦИЯ ПУТЕЙ ---
log_step("SYSTEM", "Проверка окружения...", C_CYAN)
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"  # ЗАПОМНЕНО: index.html всегда здесь
IMAGES_DIR = BASE_DIR / "images"

for folder in [STATIC_DIR, IMAGES_DIR]:
    if not folder.exists():
        folder.mkdir(parents=True, exist_ok=True)
        log_step("FS", f"Создана отсутствующая папка: {folder.name}", C_YELLOW)
    else:
        log_step("FS", f"Папка проверена: {folder.name}", C_GREEN)

# --- [STAGE 2] НАСТРОЙКИ И КЭШ ---
USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None
log_step("CACHE", "Локальный кэш инициализирован", C_MAGENTA)

class SaveData(BaseModel):
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int
    exp: int

# --- [STAGE 3] ФОНОВЫЕ ЗАДАЧИ ---
async def sync_cache_to_db():
    log_step("SYNC_LOOP", "Фоновая синхронизация запущена (интервал 30с)", C_CYAN)
    while True:
        await asyncio.sleep(30)
        if USER_CACHE and db_conn:
            try:
                count = len(USER_CACHE)
                for uid, info in USER_CACHE.items():
                    d = info["data"]
                    await db_conn.execute(
                        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, last_active=? WHERE id=?",
                        (d['score'], d['click_lvl'], d['energy'], d['max_energy'], d['pnl'], d['level'], d['exp'], int(time.time()), uid)
                    )
                await db_conn.commit()
                log_step("DB_SAVE", f"Успешно: {count} игроков синхронизированы с диском", C_GREEN)
            except Exception as e:
                log_step("DB_ERR", f"Ошибка записи: {str(e)}", C_RED)

# --- [STAGE 4] ЖИЗНЕННЫЙ ЦИКЛ ПРИЛОЖЕНИЯ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("SQLITE", "Подключение к базе данных...", C_CYAN)
    db_conn = await aiosqlite.connect(DB_PATH)
    
    log_step("SQLITE", "Настройка PRAGMA (Turbo Mode)...", C_CYAN)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=OFF")
    
    log_step("SQLITE", "Проверка структуры таблиц...", C_CYAN)
    await db_conn.execute('''CREATE TABLE IF NOT EXISTS users 
        (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
         energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
         level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)''')
    await db_conn.commit()
    
    log_step("SYSTEM", "Запуск фоновых процессов...", C_MAGENTA)
    asyncio.create_task(sync_cache_to_db())
    
    yield
    log_step("SYSTEM", "Завершение работы сервера...", C_YELLOW)
    if db_conn:
        await db_conn.close()
        log_step("SQLITE", "Соединение с БД закрыто", C_YELLOW)

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=200)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [STAGE 5] API ЭНДПОИНТЫ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    log_step("API_GET", f"Запрос баланса: ID {user_id}", C_WHITE)
    
    if user_id in USER_CACHE:
        log_step("CACHE_HIT", f"Данные ID {user_id} взяты из памяти", C_MAGENTA)
        return {"status": "ok", "data": USER_CACHE[user_id]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        user = await cursor.fetchone()
    
    if not user:
        log_step("API_NEW", f"Новый пользователь: ID {user_id}", C_YELLOW)
        return {"status": "ok", "data": {"balance": 1000, "level": 1}}
    
    u_dict = dict(user)
    USER_CACHE[user_id] = {"data": u_dict, "last_save": time.time()}
    log_step("DB_READ", f"Загружено из базы в кэш: ID {user_id}", C_CYAN)
    return {"status": "ok", "data": u_dict}

@app.post("/api/save")
async def save_game(data: SaveData):
    log_step("API_SAVE", f"Обновление кэша: ID {data.user_id} (Score: {data.score})", C_WHITE)
    USER_CACHE[data.user_id] = {"data": data.model_dump(), "last_save": time.time()}
    return {"status": "ok"}

# --- [STAGE 6] СТАТИКА И ВЕБ-ИНТЕРФЕЙС ---

class CachedStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        log_step("STATIC", f"Запрос файла: {path}", C_CYAN)
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        return response

log_step("SYSTEM", "Монтирование статических путей...", C_CYAN)
app.mount("/images", CachedStaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/static", CachedStaticFiles(directory=str(STATIC_DIR)), name="static")



@app.get("/")
async def index():
    log_step("WEB", "Отдача главной страницы index.html", C_CYAN)
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        log_step("WEB_ERR", f"КРИТИЧЕСКАЯ ОШИБКА: index.html не найден по пути {index_file}", C_RED)
        return JSONResponse({"error": "index.html missing"}, status_code=404)
    return FileResponse(index_file, headers={"Cache-Control": "public, max-age=3600"})

# --- [STAGE 7] ЗАПУСК ---
if __name__ == "__main__":
    log_step("SERVER", "Запуск UVICORN на порту 3000", C_BOLD + C_GREEN)
    uvicorn.run(app, host="0.0.0.0", port=3000, access_log=False)
