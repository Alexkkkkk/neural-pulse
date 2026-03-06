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

# ... (логирование и конфигурация остаются прежними) ...

# НОВОЕ: Таблица рефералов в lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    db_conn = await aiosqlite.connect(DB_PATH)
    await db_conn.execute("PRAGMA journal_mode=WAL")
    
    # Таблица пользователей
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
            energy REAL, max_energy INTEGER, pnl REAL, 
            level INTEGER, wallet_address TEXT, last_active INTEGER
        )
    """)
    
    # НОВОЕ: Таблица реферальных связей
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS referrals (
            referrer_id TEXT,
            friend_id TEXT,
            bonus_given INTEGER DEFAULT 0,
            PRIMARY KEY (referrer_id, friend_id)
        )
    """)

    # Таблица заданий
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS completed_tasks (
            user_id TEXT, task_id TEXT, completed_at INTEGER,
            PRIMARY KEY (user_id, task_id)
        )
    """)
    await db_conn.commit()
    
    if AIOGRAM_AVAILABLE:
        # ... (код бота остается прежним) ...
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

# --- [ОБНОВЛЕННЫЕ И НОВЫЕ ЭНДПОИНТЫ] ---

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
    
    # НОВОЕ: ЛОГИКА РЕФЕРАЛА ПРИ ПЕРВОМ ВХОДЕ
    start_bal = 0.0
    if ref and ref != uid and ref != "":
        try:
            # Начисляем бонус приглашенному
            start_bal = 5000.0
            # Начисляем бонус пригласившему (в базу напрямую, так как он может быть оффлайн)
            await db_conn.execute("UPDATE users SET balance = balance + 10000 WHERE id = ?", (ref,))
            await db_conn.execute("INSERT OR IGNORE INTO referrals (referrer_id, friend_id, bonus_given) VALUES (?, ?, 1)", (ref, uid))
            await db_conn.commit()
            # Если пригласивший онлайн, обновляем его кэш
            if ref in USER_CACHE:
                USER_CACHE[ref]["data"]["score"] += 10000
        except Exception as e:
            logger.error(f"Referral Error: {e}")

    new_data = {"score": start_bal, "click_lvl": 1, "energy": 1000.0, "max_energy": 1000, "pnl": 0.0, "level": 1, "wallet_address": None}
    USER_CACHE[uid] = {"data": new_data, "last_seen": time.time()}
    return {"status": "ok", "data": new_data}

# НОВОЕ: Получение списка друзей
@app.get("/api/friends/{user_id}")
async def get_friends(user_id: str):
    """Возвращает список ID пользователей, которые зашли по ссылке данного игрока"""
    async with db_conn.execute("SELECT friend_id FROM referrals WHERE referrer_id = ?", (user_id,)) as cur:
        rows = await cur.fetchall()
    
    friends = [{"user_id": r[0]} for r in rows]
    return {"status": "ok", "friends": friends}

# ... (остальные функции: save, leaderboard, tasks — остаются без изменений) ...

@app.post("/api/save")
async def save(data: SaveData):
    # Добавляем click_lvl в сохранение, если его нет
    uid = str(data.user_id)
    USER_CACHE[uid] = {"data": data.model_dump(), "last_seen": time.time()}
    return {"status": "ok"}

# ... (index и запуск) ...
