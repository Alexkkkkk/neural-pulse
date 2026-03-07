import os, time
import aiosqlite, uvicorn
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, ORJSONResponse

# Определяем пути относительно /app
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "data" / "game.db"
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(default_response_class=ORJSONResponse)

# Инициализация БД при старте
@app.on_event("startup")
async def startup():
    os.makedirs(BASE_DIR / "data", exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, level INTEGER DEFAULT 1,
            energy REAL, max_energy INTEGER, pnl REAL, last_active INTEGER)""")
        await db.commit()

# --- [API ЭНДПОИНТЫ] ---
@app.get("/api/balance/{uid}")
async def get_bal(uid: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id=?", (uid,)) as cur:
            row = await cur.fetchone()
            if row: return {"status": "ok", "data": dict(row)}
            
            # Если юзера нет — создаем
            now = int(time.time())
            await db.execute("INSERT INTO users VALUES (?,1000,1,1000,1000,0,?)", (uid, now))
            await db.commit()
            return {"status": "ok", "data": {"balance": 1000, "level": 1, "energy": 1000}}

# --- [РАЗДАЧА ФРОНТЕНДА] ---
@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

# Монтируем статику (стили, скрипты, картинки)
# Теперь они будут доступны по путям /static/js/core.js и т.д.
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
