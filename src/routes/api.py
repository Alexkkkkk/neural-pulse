from fastapi import Request
import time

LAST_SAVE = {}
USER_CACHE = {} # Импортируется из контроллера в реальном приложении

async def get_balance_logic(user_id, db_conn, aiosqlite):
    db_conn.row_factory = aiosqlite.Row
    async with db_conn.execute("SELECT * FROM users WHERE id=?", (user_id,)) as cur:
        row = await cur.fetchone()
    
    now = int(time.time())
    if row:
        d = dict(row)
        off_time = min(now - (d['last_active'] or now), 10800)
        earned = (d['pnl'] / 3600) * off_time
        return {"status": "ok", "data": {
            "score": d["balance"] + earned, "tap_power": d["click_lvl"],
            "pnl": d["pnl"], "energy": d["energy"], "level": d["level"],
            "max_energy": d["max_energy"], "multiplier": 1
        }}
    
    await db_conn.execute("INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) VALUES (?,1000,1,0,1000,1000,1,?)", (user_id, now))
    await db_conn.commit()
    return {"status": "ok", "data": {"score": 1000, "tap_power": 1, "pnl": 0, "energy": 1000, "max_energy": 1000, "level": 1, "multiplier": 1}}
