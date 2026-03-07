import socketio, uvicorn, aioredis

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = socketio.ASGIApp(sio)
redis = aioredis.from_url("redis://redis:6379/0")

@sio.on('tap')
async def on_tap(sid, data):
    # Мгновенная запись в стрим для обработки Clicker-воркером
    await redis.xadd("stream:taps", {"uid": data['uid'], "x": data['x'], "y": data['y']})
    await sio.emit('global_pulse', data, skip_sid=sid)

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8080)
