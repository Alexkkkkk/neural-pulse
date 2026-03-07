import os, time
import aiosqlite, uvicorn
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Пути
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "data" / "game.db"
STATIC_DIR = BASE_DIR / "static"

app = FastAPI()

# Создаем базу при старте
@app.on_event("startup")
async def startup():
    os.makedirs(BASE_DIR / "data", exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance REAL)")
        await db.commit()

# Раздача главной страницы
@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

# Монтируем статику (дизайн, лого, скрипты)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/api/balance/{uid}")
async def get_bal(uid: str):
    return {"status": "ok", "balance": 1000}
