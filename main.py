import os, sys, asyncio, sqlite3, uvicorn, logging, random, time, json
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Update
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

# --- НАСТРОЙКИ ---
TOKEN = "8257287930:AAH4934ktqBYNlhELudektx9ptxP_5eefTU"
MY_DOMAIN = "np.bothost.ru"
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = BASE_DIR / "game.db"
STATIC_DIR = BASE_DIR / "static"

# Настройка детального логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NeuralPulse")

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# --- МОДЕЛИ ---
class SaveData(BaseModel):
    user_id: int
    score: int
    click_lvl: int = 1

# --- ЖИЗНЕННЫЙ ЦИКЛ ПРИЛОЖЕНИЯ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 [SYSTEM] Начинается запуск Neural Pulse AI...")
    
    # Инициализация БД
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS users 
                (id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, 
                 click_lvl INTEGER DEFAULT 1, last_active INTEGER DEFAULT 0, wallet TEXT)''')
            conn.commit()
        logger.info("📁 [DB] База данных проверена и готова.")
    except Exception as e:
        logger.error(f"❌ [DB ERROR] Ошибка инициализации БД: {e}")

    # Работа с Вебхуком
    try:
        current_webhook = await bot.get_webhook_info()
        logger.info(f"🔍 [WEBHOOK INFO] Текущий URL: {current_webhook.url}")
        
        await bot.delete_webhook(drop_pending_updates=True)
        logger.info("🧹 [WEBHOOK] Старые обновления очищены.")
        
        webhook_url = f"https://{MY_DOMAIN}/webhook"
        await bot.set_webhook(url=webhook_url)
        logger.info(f"✅ [WEBHOOK SET] Установлен новый URL: {webhook_url}")
    except Exception as e:
        logger.error(f"❌ [WEBHOOK ERROR] Не удалось установить вебхук: {e}")
    
    yield
    logger.info("🛑 [SYSTEM] Остановка сервера...")
    await bot.session.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API ЭНДПОИНТЫ ---

@app.get("/api/balance/{user_id}")
async def get_balance(user_id: str):
    logger.info(f"👤 [API] Запрос баланса для ID: {user_id}")
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            logger.info(f"🆕 [API] Регистрация нового игрока: {user_id}")
            conn.execute("INSERT INTO users (id, balance, last_active) VALUES (?, 1000, ?)", 
                         (user_id, int(time.time())))
            conn.commit()
            return {"status": "ok", "data": {"balance": 1000, "click_lvl": 1}}
        return {"status": "ok", "data": dict(user)}

@app.post("/webhook")
async def bot_webhook(request: Request):
    try:
        # Читаем "сырое" тело запроса
        body = await request.body()
        data = json.loads(body)
        
        # Логируем факт получения запроса от Telegram
        logger.info(f"📩 [WEBHOOK IN] Получен Update ID: {data.get('update_id')}")
        
        # Передаем в aiogram
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
        
        return {"ok": True}
    except Exception as e:
        logger.error(f"❌ [WEBHOOK ERROR] Ошибка при обработке входящего запроса: {e}")
        return JSONResponse(content={"ok": False, "error": str(e)}, status_code=500)

# --- ЛОГИКА БОТА ---

@dp.message(F.text.startswith("/start"))
async def cmd_start(m: types.Message):
    logger.info(f"🤖 [BOT] Команда /start от {m.from_user.id} (@{m.from_user.username})")
    
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 ИГРАТЬ В 1 КЛИК", web_app=WebAppInfo(url=f"https://{MY_DOMAIN}/"))
    ]])
    
    welcome_text = (
        f"<b>Привет, {m.from_user.first_name}!</b>\n\n"
        f"Neural Pulse AI запущен и готов к работе. Добывай NP и готовься к листингу!"
    )
    
    try:
        await m.answer(welcome_text, reply_markup=kb)
        logger.info(f"📤 [BOT] Ответ отправлен пользователю {m.from_user.id}")
    except Exception as e:
        logger.error(f"❌ [BOT ERROR] Не удалось отправить сообщение: {e}")

# --- СТАТИЧЕСКИЕ ФАЙЛЫ ---

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if (STATIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images_fix")

@app.get("/")
async def index():
    logger.info("🌐 [WEB] Кто-то зашел на главную страницу игры.")
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    logger.error("❌ [WEB ERROR] Файл static/index.html не найден!")
    return {"error": "index.html not found"}

if __name__ == "__main__":
    logger.info("🔌 [SYSTEM] Запуск uvicorn на порту 3000...")
    uvicorn.run(app, host="0.0.0.0", port=3000)
