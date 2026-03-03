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

# --- [КОНФИГ И ЦВЕТА] ---
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"  # ЗАПОМНЕНО: index.html всегда здесь
IMAGES_DIR = BASE_DIR / "images"

C = {"G": "\033[92m", "Y": "\033[93m", "R": "\033[91m", "C": "\033[96m", "B": "\033[1m", "E": "\033[0m"}

def log_step(cat: str, msg: str, col: str = C["G"]):
    curr_time = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{C['B']}[{curr_time}]{C['E']} {col}{cat.ljust(10)}{C['E']} | {msg}", flush=True)

# --- [STAGE 1] ПОДГОТОВКА ФС ---
for folder in [STATIC_DIR, IMAGES_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

class SaveData(BaseModel):
    user_id: str
    score: float
    click_lvl: int
    energy: float
    max_energy: int
    pnl: float
    level: int
    exp: int

# --- [STAGE 2] ФОНОВАЯ СИНХРОНИЗАЦИЯ ---
async def sync_cache_to_db():
    log_step("SYSTEM", "Цикл синхронизации запущен", C["C"])
    while True:
        try:
            await asyncio.sleep(60) # Сохраняем раз в минуту для стабильности
            if USER_CACHE and db_conn:
                current_cache = USER_CACHE.copy()
                for uid, info in current_cache.items():
                    d = info["data"]
                    await db_conn.execute(
                        "UPDATE users SET balance=?, click_lvl=?, energy=?, max_energy=?, pnl=?, level=?, exp=?, last_active=? WHERE id=?",
                        (d['score'], d['click_lvl'], d['energy'], d['max_energy'], d['pnl'], d['level'], d['exp'], int(time.time()), uid)
                    )
                await db_conn.commit()
                log_step("DB_SYNC", f"Данные {len(current_cache)} игроков сброшены на диск")
                
                # Защита от утечки памяти (RAM)
                if len(USER_CACHE) > 500:
                    USER_CACHE.clear()
                    log_step("MEMORY", "Кэш очищен для экономии ресурсов", C["Y"])
        except Exception as e:
            log_step("SYNC_ERR", f"Критический сбой БД: {e}", C["R"])

# --- [STAGE 3] ЖИЗНЕННЫЙ ЦИКЛ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    log_step("DB_START", "Подключение к SQLite (WAL mode)...")
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=NORMAL")
    await db_conn.execute('''CREATE TABLE IF NOT EXISTS users 
        (id TEXT PRIMARY KEY, balance REAL DEFAULT 1000, click_lvl INTEGER DEFAULT 1, 
         energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, pnl REAL DEFAULT 0, 
         level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, last_active INTEGER DEFAULT 0)''')
    await db_conn.commit()
    
    sync_task = asyncio.create_task(sync_cache_to_db())
    log_step("SYSTEM", "Neural Pulse Engine запущен!", C["B"] + C["G"])
    yield
    sync_task.cancel()
    if db_conn:
        await db_conn.close()
    log_step("SYSTEM", "Завершение работы...", C["Y"])

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [STAGE 4] API ---

@app.get("/health")
async def health():
    return {"status": "ok", "cache_size": len(USER_CACHE)}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    if user_id in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[user_id]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        user = await cursor.fetchone()
    
    if not user:
        return {"status": "ok", "data": {"balance": 1000, "level": 1}}
    
    u_dict = dict(user)
    USER_CACHE[user_id] = {"data": u_dict, "last_save": time.time()}
    return {"status": "ok", "data": u_dict}

@app.post("/api/save")
async def save_game(data: SaveData):
    USER_CACHE[data.user_id] = {"data": data.model_dump(), "last_save": time.time()}
    return {"status": "ok"}

# --- [STAGE 5] СТАТИКА ---
# Кэшируем на 7 дней для быстрой загрузки у пользователей
class CachedStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        return response

app.mount("/images", CachedStaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/static", CachedStaticFiles(directory=str(STATIC_DIR)), name="static")



@app.get("/")
async def index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        log_step("ERROR", "index.html отсутствует в папке static!", C["R"])
        return JSONResponse({"error": "Static file missing"}, status_code=404)
    return FileResponse(index_file, headers={"Cache-Control": "public, max-age=3600"})

if __name__ == "__main__":
    # Запуск с оптимальными настройками для Pro тарифа
    uvicorn.run("main:app", host="0.0.0.0", port=3000, access_log=False, workers=1)
