import asyncio, aioredis, orjson

async def run_worker():
    rd = aioredis.from_url("redis://redis:6379/0")
    while True:
        batch = await rd.xread({"stream:taps": "0-0"}, count=500, block=100)
        for _, messages in batch:
            for m_id, data in messages:
                uid = data[b'uid'].decode()
                raw = await rd.get(f"u:{uid}")
                if raw:
                    user = orjson.loads(raw)
                    if user['en'] > 0:
                        user['bal'] += user['pow']
                        user['en'] -= 1
                        await rd.set(f"u:{uid}", orjson.dumps(user))
                await rd.xdel("stream:taps", m_id)
        await asyncio.sleep(0.01)

asyncio.run(run_worker())
