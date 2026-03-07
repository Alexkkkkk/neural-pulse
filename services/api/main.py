from fastapi import FastAPI
import aioredis, orjson, os

app = FastAPI()
redis = aioredis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)

@app.get("/api/balance/{uid}")
async def get_user(uid: str):
    raw = await redis.get(f"user:{uid}")
    if raw:
        return {"status": "ok", "data": orjson.loads(raw)}
    
    # Новый пользователь (Твой стартовый баланс 1000)
    user = {"score": 1000.0, "tap_power": 1, "pnl": 0.0, "energy": 1000.0, "max_energy": 1000, "level": 1}
    await redis.set(f"user:{uid}", orjson.dumps(user))
    return {"status": "ok", "data": user}
