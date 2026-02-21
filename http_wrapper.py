import threading
import os
import uvicorn
from fastapi import FastAPI
import subprocess
import sys

app = FastAPI()

# Ответ для хостинга, чтобы он видел, что "сайт" работает
@app.get("/{path:path}")
async def health_check(path: str = ""):
    return {"status": "ok", "bot": "Neural Pulse Active", "path": path}

def run_bot():
    print("--- [PROCESS] Запуск Telegram бота ---")
    # Запускаем основной файл бота
    subprocess.check_call([sys.executable, "main.py"])

if __name__ == "__main__":
    # 1. Запуск бота в отдельном потоке
    bot_thread = threading.Thread(target=run_bot, daemon=True)
    bot_thread.start()
    
    # 2. Запуск веб-сервера на порту 3000 (стандарт Bothost)
    port = int(os.environ.get("PORT", 3000))
    print(f"--- [SERVER] Старт веб-интерфейса на порту {port} ---")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
