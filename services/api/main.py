from fastapi import FastAPI
import aioredis, orjson

app = FastAPI()
redis = aioredis.from_url("redis://redis:6379/0")

@app.get("/api/init/{uid}")
async def init_user(uid: str):
    data = await redis.get(f"u:{uid}")
    if not data:
        user = {"id": uid, "bal": 0.0, "en": 1000, "m_en": 1000, "pow": 1}
        await redis.set(f"u:{uid}", orjson.dumps(user))
        return user
    return orjson.loads(data)
