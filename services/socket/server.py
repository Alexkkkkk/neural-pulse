import os, socketio, uvicorn, orjson
from redis.asyncio import Redis

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = socketio.ASGIApp(sio)
redis = Redis(host=os.getenv("REDIS_HOST", "redis"), port=6379)

@sio.on('tap')
async def handle_tap(sid, data):
    uid = data.get('uid')
    if uid:
        # Кладём клик в список 'queue:taps' для обработки воркером
        await redis.rpush("queue:taps", orjson.dumps({"uid": uid}))
        # Подтверждаем получение (опционально)
        await sio.emit('tap_ack', {"status": "ok"}, to=sid)

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8080)
