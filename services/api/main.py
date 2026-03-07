import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

app = FastAPI()

# Определяем путь к папке со статикой (дизайном)
# BASE_DIR указывает на корень проекта (/app)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = BASE_DIR / "static"

# ВАЖНО: Монтируем папку static. 
# Теперь всё, что лежит в static/, будет доступно по ссылке /static/
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Эндпоинт для открытия главной страницы
@app.get("/")
async def read_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"error": "index.html not found"}

# Твой API для баланса
@app.get("/api/balance/{uid}")
async def get_balance(uid: str):
    # Тут будет логика базы данных, пока заглушка
    return {"status": "ok", "balance": 1000}
