import asyncio, os, orjson, aiosqlite
from redis.asyncio import Redis

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
DB_PATH = "/app/data/game.db"

async def process_taps():
    rd = Redis(host=REDIS_HOST, port=6379, decode_responses=True)
    print("🚀 Clicker Worker started...")

    while True:
        # Вытаскиваем задачу из очереди Redis
        raw_tap = await rd.blpop("queue:taps", timeout=1)
        if raw_tap:
            data = orjson.loads(raw_tap[1])
            uid = data['uid']
            
            # Обновляем данные в Redis (атомарно)
            user_raw = await rd.get(f"u:{uid}")
            if user_raw:
                user = orjson.loads(user_raw)
                if user['energy'] >= user['tap_power']:
                    user['score'] += user['tap_power']
                    user['energy'] -= user['tap_power']
                    await rd.set(f"u:{uid}", orjson.dumps(user))
        
        await asyncio.sleep(0.01) # Чтобы не перегружать CPU

async def main():
    await process_taps()

if __name__ == "__main__":
    asyncio.run(main())
