import os, orjson
from fastapi import FastAPI
from redis.asyncio import Redis

app = FastAPI()
# Подключаемся к Redis (в Docker-compose имя хоста будет 'redis')
redis = Redis(host=os.getenv("REDIS_HOST", "redis"), port=6379, decode_responses=True)

@app.get("/api/balance/{uid}")
async def get_balance(uid: str):
    # Пытаемся взять данные из кэша Redis
    user_data = await redis.get(f"u:{uid}")
    
    if user_data:
        return {"status": "ok", "data": orjson.loads(user_data)}
    
    # Если юзера нет, создаем начальный профиль
    new_user = {
        "score": 1000.0,
        "tap_power": 1,
        "pnl": 0.0,
        "energy": 1000.0,
        "max_energy": 1000,
        "level": 1
    }
    await redis.set(f"u:{uid}", orjson.dumps(new_user))
    return {"status": "ok", "data": new_user}

@app.get("/api/health")
async def health():
    return {"status": "alive"}
