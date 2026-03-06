import os, asyncio, logging, time, datetime, sys
import aiosqlite
import uvicorn
import aiohttp
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, Union, List
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field

try:
    from aiogram import Bot, Dispatcher, types
    from aiogram.filters import Command, CommandObject
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    AIOGRAM_AVAILABLE = True
except ImportError:
    AIOGRAM_AVAILABLE = False

# --- [ЛОГИРОВАНИЕ] ---
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
WEB_APP_URL = "https://np.bothost.ru/"
ADMIN_WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"
TONCENTER_API_KEY = "" 

USER_CACHE: Dict[str, dict] = {}
db_conn: Optional[aiosqlite.Connection] = None

# Список доступных заданий (можно вынести в БД, но для начала оставим тут)
AVAILABLE_TASKS = [
    {"id": "sub_tg", "name": "Join Neural Channel", "reward": 5000, "link": "https://t.me/your_channel"},
    {"id": "follow_x", "name": "Follow Pulse X", "reward": 3000, "link": "https://x.com/your_profile"},
    {"id": "boost_ton", "name": "Verify Wallet", "reward": 1000, "link": "#"}
]

# --- [МОДЕЛИ] ---
class SaveData(BaseModel):
    user_id: Union[str, int]
    score: Any = 0
    energy: Any = 0
    max_energy: Any = 1000
    pnl: Any = 0
    level: Any = 1
    click_lvl: Any = 1
    wallet_address: Optional[Any] = None  
    referrer_id: Optional[Any] = None
    model_config = ConfigDict(extra='allow', arbitrary_types_allowed=True, populate_by_name=True)

class PaymentVerify(BaseModel):
    user_id: Union[str, int]
    amount: Any

class TaskClaim(BaseModel):
    user_id: str
    task_id: str

# --- [ФУНКЦИИ БЛОКЧЕЙНА] ---
async def verify_ton_tx(user_id: str, expected_ton: float):
    url = f"https://toncenter.com/api/v2/getTransactions?address={ADMIN_WALLET}&limit=20"
    headers = {"X-API-Key": TONCENTER_API_KEY} if TONCENTER_API_KEY else {}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status != 200: return False
                data = await resp.json()
                for tx in data.get('result', []):
                    in_msg = tx.get('in_msg', {})
                    if not in_msg: continue
                    value = int(in_msg.get('value', 0)) / 1e9
                    comment = in_msg.get('message', '')
                    if value >= float(expected_ton) * 0.95 and str(user_id) in comment:
                        return True
    except Exception as e:
        logger.error(f"TON API Error: {e}")
    return False

# --- [ФОНОВЫЕ ЗАДАЧИ] ---
async def batch_db_update():
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        try:
            users_to_update = []
            for uid, entry in list(USER_CACHE.items()):
                d = entry.get("data")
                if not d: continue
                users_to_update.append((
                    str(uid), float(d.get('score', 0)), int(d.get('click_lvl', 1)), 
                    float(d.get('energy', 0)), int(d.get('max_energy', 1000)), 
                    float(d.get('pnl', 0)), int(d.get('level', 1)), 
                    str(d.get('wallet_address')) if d.get('wallet_address') else None,
                    int(time.time())
                ))
            if users_to_update:
                await db_conn.executemany("""
                    INSERT INTO users (id, balance, click_lvl, energy, max_energy, pnl, level, wallet_address, last_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance, click_lvl=excluded.click_lvl,
                        energy=excluded.energy, max_energy=excluded.max_energy,
                        pnl=excluded.pnl, level=excluded.level, 
                        wallet_address=excluded.wallet_address, last_active=excluded.last_active
                """, users_to_update)
                await db_conn.commit()
        except Exception as e:
            logger.error(f"DB Batch Error: {e}")

# --- [LIFESPAN] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    # Основная таблица
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
            energy REAL, max_energy INTEGER, pnl REAL, 
            level INTEGER, wallet_address TEXT, last_active INTEGER
        )
    """)
    # ТАБЛИЦА ЗАДАНИЙ
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS completed_tasks (
            user_id TEXT,
            task_id TEXT,
            completed_at INTEGER,
            PRIMARY KEY (user_id, task_id)
        )
    """)
    await db_conn.commit()
    
    if AIOGRAM_AVAILABLE:
        bot = Bot(token=API_TOKEN)
        dp = Dispatcher()
        @dp.message(Command("start"))
        async def start(m: types.Message, command: CommandObject):
            ref_id = command.args if command.args else ""
            url = f"{WEB_APP_URL}?tgWebAppStartParam={ref_id}"
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="Вход в Neural Pulse 🚀", web_app=WebAppInfo(url=url))
            ]])
            await m.answer(f"<b>Neural Pulse Online</b>\nДобро пожаловать.", reply_markup=kb, parse_mode="HTML")
        asyncio.create_task(dp.start_polling(bot))
    
    asyncio.create_task(batch_db_update())
    yield
    if db_conn: await db_conn.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- [API ЭНДПОИНТЫ] ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str, ref: Optional[str] = None):
    uid = str(user_id)
    if uid in USER_CACHE:
        return {"status": "ok", "data": USER_CACHE[uid]["data"]}
    
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id = ?", (uid,)) as cur:
        row = await cur.fetchone()
    
    if row:
        data = dict(row)
        data["score"] = data.pop("balance")
        USER_CACHE[uid] = {"data": data, "last_seen": time.time()}
        return {"status": "ok", "data": data}
    
    start_bal = 5000.0 if (ref and ref != uid and ref != "") else 0.0
    new_data = {"score": start_bal, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}
    USER_CACHE[uid] = {"data": new_data, "last_seen": time.time()}
    return {"status": "ok", "data": new_data}

@app.post("/api/save")
async def save(data: SaveData):
    USER_CACHE[str(data.user_id)] = {"data": data.model_dump(), "last_seen": time.time()}
    return {"status": "ok"}

@app.get("/api/leaderboard")
async def get_leaderboard():
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT id, balance, level FROM users ORDER BY balance DESC LIMIT 10") as cur:
        rows = await cur.fetchall()
    leaders = [{"rank": i+1, "user_id": r["id"], "score": r["balance"], "level": r["level"]} for i, r in enumerate(rows)]
    return {"status": "ok", "leaders": leaders}

# --- СИСТЕМА ЗАДАНИЙ (НОВОЕ) ---

@app.get("/api/tasks/{user_id}")
async def get_tasks(user_id: str):
    """Возвращает список заданий с пометкой о выполнении"""
    async with db_conn.execute("SELECT task_id FROM completed_tasks WHERE user_id = ?", (user_id,)) as cur:
        completed_rows = await cur.fetchall()
    
    completed_ids = [r[0] for r in completed_rows]
    
    tasks_with_status = []
    for t in AVAILABLE_TASKS:
        task_data = t.copy()
        task_data["completed"] = t["id"] in completed_ids
        tasks_with_status.append(task_data)
        
    return {"status": "ok", "tasks": tasks_with_status}

@app.post("/api/claim-task")
async def claim_task(payload: TaskClaim):
    """Зачисляет награду за задание"""
    uid = payload.user_id
    tid = payload.task_id
    
    # 1. Проверяем, не выполнено ли уже
    async with db_conn.execute("SELECT 1 FROM completed_tasks WHERE user_id = ? AND task_id = ?", (uid, tid)) as cur:
        if await cur.fetchone():
            return {"status": "error", "message": "Task already completed"}
    
    # 2. Ищем награду
    reward = next((t["reward"] for t in AVAILABLE_TASKS if t["id"] == tid), 0)
    
    # 3. Записываем выполнение и начисляем в кэш
    await db_conn.execute("INSERT INTO completed_tasks (user_id, task_id, completed_at) VALUES (?, ?, ?)", 
                         (uid, tid, int(time.time())))
    await db_conn.commit()
    
    if uid in USER_CACHE:
        USER_CACHE[uid]["data"]["score"] += reward
        return {"status": "ok", "new_balance": USER_CACHE[uid]["data"]["score"]}
    
    return {"status": "ok", "message": "Task marked as done. Balance will update on next sync."}

# --- ПЛАТЕЖИ ---

@app.get("/api/payment-params/{user_id}")
async def get_payment_params(user_id: str):
    return {"address": ADMIN_WALLET, "comment": f"ref_{user_id}", "boost_price": 0.1}

@app.post("/api/verify-payment")
async def verify_payment(payload: PaymentVerify):
    search_comment = f"ref_{payload.user_id}"
    success = await verify_ton_tx(search_comment, payload.amount)
    if success:
        uid = str(payload.user_id)
        if uid in USER_CACHE:
            USER_CACHE[uid]["data"]["energy"] = USER_CACHE[uid]["data"]["max_energy"]
            USER_CACHE[uid]["data"]["score"] += 10000
            return {"status": "ok", "message": "Success!"}
    return {"status": "error", "message": "Tx not found"}

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
