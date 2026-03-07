import os, time, asyncio, logging
import aiosqlite, uvicorn
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, ORJSONResponse

# Настраиваем пути относительно корня /app
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "data" / "game.db"
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(default_response_class=ORJSONResponse)

# Создаем папку data если её нет
os.makedirs(BASE_DIR / "data", exist_ok=True)

@app.on_event("startup")
async def startup():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, level INTEGER DEFAULT 1,
            energy REAL, max_energy INTEGER, pnl REAL, last_active INTEGER)""")
        await db.commit()

# --- [API] ---
@app.get("/api/balance/{uid}")
async def get_bal(uid: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id=?", (uid,)) as cur:
            row = await cur.fetchone()
            if row:
                return {"status": "ok", "data": dict(row)}
            
            # Новый юзер
            new_u = (uid, 1000.0, 1, 1000.0, 1000, 0.0, int(time.time()))
            await db.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?)", new_u)
            await db.commit()
            return {"status": "ok", "data": {"score": 1000, "level": 1, "energy": 1000}}

# --- [РАЗДАЧА СТАТИКИ] ---
# Важно: это должно быть ПОСЛЕ API
@app.get("/")
async def read_index():
    return FileResponse(STATIC_DIR / "index.html")

# Монтируем папку static для JS/CSS/Images
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
