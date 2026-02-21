import threading
import os
import uvicorn
from fastapi import FastAPI
import subprocess
import sys

app = FastAPI()

@app.get("/")
async def root():
    return {"status": "ok", "message": "Neural Pulse Bot is running"}

def run_bot():
    print("--- Запуск основного процесса бота ---")
    try:
        # Запускает ваш main.py из папки bot
        subprocess.check_call([sys.executable, "bot/main.py"])
    except Exception as e:
        print(f"Ошибка в работе бота: {e}")

if __name__ == "__main__":
    # 1. Запускаем бота в фоне
    bot_thread = threading.Thread(target=run_bot, daemon=True)
    bot_thread.start()
    
    # 2. Запускаем веб-сервер, который требует хостинг
    port = int(os.environ.get("PORT", 3000))
    print(f"--- Запуск веб-сервера на порту {port} ---")
    uvicorn.run(app, host="0.0.0.0", port=port)
