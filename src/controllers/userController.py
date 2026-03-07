import time
import asyncio
import logging

logger = logging.getLogger("NP_ULTRA")
USER_CACHE = {}

async def db_syncer(db_conn):
    while True:
        await asyncio.sleep(15)
        if not USER_CACHE or not db_conn: continue
        try:
            cache_copy = USER_CACHE.copy()
            USER_CACHE.clear() 
            to_save = []
            now_ts = int(time.time())
            for uid, entry in cache_copy.items():
                d = entry.get("data", {})
                to_save.append((
                    str(uid), float(d.get('score', 0)), int(d.get('tap_power', 1)), 
                    float(d.get('pnl', 0)), float(d.get('energy', 0)), 
                    int(d.get('max_energy', 1000)), int(d.get('level', 1)), now_ts
                ))
            if to_save:
                async with db_conn.execute("BEGIN TRANSACTION"):
                    await db_conn.executemany("""
                        INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active)
                        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                        balance=excluded.balance, click_lvl=excluded.click_lvl, pnl=excluded.pnl,
                        energy=excluded.energy, level=excluded.level, last_active=excluded.last_active
                    """, to_save)
                await db_conn.commit()
                logger.info(f"💾 Sync OK: {len(to_save)} users.")
        except Exception as e: logger.error(f"Sync Error: {e}")
