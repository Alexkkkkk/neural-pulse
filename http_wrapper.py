import os, asyncio, sqlite3, uvicorn, logging, time, sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# --- КОНФИГУРАЦИЯ ЛОГИРОВАНИЯ ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NEURAL_PULSE")

# ПУТИ К ФАЙЛАМ
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "game.db"

# ДАННЫЕ ПРОЕКТА
TOKEN = "8257287930:AAFOaH0ZxRH200r5sGLclf95co8wU7AUBwg"
MY_DOMAIN = "np.bothost.ru"

# --- ФУНКЦИЯ ДИАГНОСТИКИ (СТАРТОВАЯ ПРОВЕРКА) ---
def run_diagnostic():
    logger.info("=== [STARTUP DIAGNOSTIC] ===")
    logger.info(f"Working Directory: {BASE_DIR}")
    
    # Проверка папки static и index.html
    if STATIC_DIR.exists():
        logger.info(f"✅ Static folder found: {STATIC_DIR}")
        if (STATIC_DIR / "index.html").exists():
            logger.info("✅ index.html is present in static.")
        else:
            logger.error("❌ index.html is MISSING in static folder!")
    else:
        logger.error(f"❌ Static folder NOT FOUND at {STATIC_DIR}")

    # Подготовка папки для БД
    try:
        DATA_DIR.mkdir(exist_ok=True)
        logger.info(f"✅ Data directory ready: {DATA_DIR}")
    except Exception as e:
        logger.error(f"❌ Could not create data directory: {e}")
    
    logger.info("=== [DIAGNOSTIC END] ===")

# --- ИГРОВАЯ ЛОГИКА ---
BASE_TARGETS = [
    600000, 900000, 1400000, 2100000, 3000000, 4100000, 5400000, 6900000, 8600000, 10500000, 
    12600000, 14900000, 17400000, 20100000, 23000000, 26100000, 29400000, 32900000, 36600000, 40500000
]
current_jackpots = [float(t * 0.01) for t in BASE_TARGETS] 

bot = Bot(token=TOKEN)
dp = Dispatcher()

class SaveData(BaseModel):
    user_id: int
    score: int
    league_id: int
    click_lvl: int = 1
    bot_lvl: int = 0
    won_jackpot: bool = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Запуск диагностики
    run_diagnostic()
    
    # 2. Инициализация БД
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS users 
                            (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, 
                             click_lvl INTEGER DEFAULT 1, bot_lvl INTEGER DEFAULT 0, 
                             last_collect INTEGER DEFAULT 0, league_id INTEGER DEFAULT 1)''')
            conn.execute("CREATE INDEX IF NOT EXISTS idx_balance ON users (balance DESC)")
            conn.commit()
        logger.info("✅ Database initialized successfully.")
    except Exception as e:
        logger.error(f"❌ Database error: {e}")

    # 3. Запуск бота
    bot_task = asyncio.create_task(dp.start_polling(bot))
    logger.info("🚀 Telegram Polling started.")
    
    yield
    
    bot_task.cancel()
    logger.info("🛑 Server shutting down...")

app = FastAPI(lifespan=lifespan)

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Монтирование статики
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_game():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return index_path.read_text(encoding="utf-8")
    return "<h1 style='color:red; text-align:center;'>Neural Pulse: static/index.html not found!</h1>"

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    icon_path = STATIC_DIR / "images" / "unnamed4.png"
    return FileResponse(icon_path) if icon_path.exists() else Response(status_code=204)

# --- API ЭНДПОИНТЫ ---

@app.post("/api/save")
async def save_progress(data: SaveData):
    uid = str(data.user_id)
    now = int(time.time())
    l_idx = max(0, min(data.league_id - 1, 19))

    if data.won_jackpot:
        current_jackpots[l_idx] = 0 
        logger.info(f"!!! JACKPOT WON by {uid} !!!")
    else:
        current_jackpots[l_idx] += (data.league_id * 0.1)

    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("""
            INSERT INTO users (id, balance, click_lvl, bot_lvl, last_collect, league_id) 
            VALUES (?, ?, ?, ?, ?, ?) 
            ON CONFLICT(id) DO UPDATE SET 
                balance = ?, click_lvl = ?, bot_lvl = ?, last_collect = ?, league_id = ?
        """, (uid, data.score, data.click_lvl, data.bot_lvl, now, data.league_id,
              data.score, data.click_lvl, data.bot_lvl, now, data.league_id))
        conn.commit()

    return {"status": "success", "global_jackpot": round(current_jackpots[l_idx], 2), "target": BASE_TARGETS[l_idx]}

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    now = int(time.time())
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        
        if not row:
            return {"balance": 1000, "click_lvl": 1, "bot_lvl": 0, "league_id": 1, "offline_profit": 0}
        
        offline_profit = 0
        if row["bot_lvl"] > 0 and row["last_collect"] > 0:
            seconds = min(now - row["last_collect"], 28800) # Макс 8 часов
            if seconds > 60:
                offline_profit = int(seconds * row["bot_lvl"] * 1.5)
        
        return {
            "balance": row["balance"] + offline_profit,
            "click_lvl": row["click_lvl"],
            "bot_lvl": row["bot_lvl"],
            "league_id": row["league_id"],
            "offline_profit": offline_profit
        }

@app.get("/api/leaderboard")
async def get_leaderboard(user_id: str = None):
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        top_rows = conn.execute("SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10").fetchall()
        top10 = [{"user_id": r["id"], "score": r["balance"]} for r in top_rows]
        
        user_rank = 0
        if user_id:
            res = conn.execute("SELECT COUNT(*) + 1 FROM users WHERE balance > (SELECT balance FROM users WHERE id = ?)", (user_id,)).fetchone()
            user_rank = res[0] if res else 0

        return {"top10": top10, "user_rank": user_rank}

# --- БОТ ---
@dp.message(F.text.startswith("/start"))
async def start_handler(message: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Запустить Neural Pulse", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    await message.answer(
        f"Привет, {message.from_user.first_name}! 🚀\nТвой нейронный пульс готов к разгону. Нажми кнопку ниже, чтобы начать.",
        reply_markup=kb
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, log_level="info")
