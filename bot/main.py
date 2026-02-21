import os
import asyncio
import logging
import sys
import sqlite3
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, WebAppInfo, CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramConflictError

# Настройка логирования (вывод в консоль хостинга)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# --- КОНФИГУРАЦИЯ ---
# Берем данные из .env или настроек Bothost
TOKEN = os.getenv("BOT_TOKEN") or "8257287930:AAFb7BvbLCRncS80ZQX3frzafGlsLcwO0QQ"
ADMIN_ID = os.getenv("ADMIN_ID") or "476014374"
WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"
WEBAPP_URL = "https://ai.bothost.ru/" 

# Путь к базе данных в папку /bot/data
DB_PATH = "data/bot_database.db"

def init_db():
    os.makedirs("data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            level INTEGER DEFAULT 1,
            balance REAL DEFAULT 0.0
        )
    ''')
    conn.commit()
    conn.close()
    logger.info("✅ База данных инициализирована успешно")

init_db()

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Обработчик команды /start
@dp.message(Command("start"))
async def start_command(message: types.Message):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)', 
                   (message.from_user.id, message.from_user.username))
    conn.commit()
    conn.close()

    welcome_text = (
        "💎 **NeuralPulse AI**\n\n"
        "Зарабатывай токены, улучшай нейросеть и выводи прибыль.\n\n"
        f"💳 **Кошелек активации:**\n`{WALLET}`"
    )
    
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text="🎮 Запустить App", web_app=WebAppInfo(url=WEBAPP_URL)))
    
    await message.answer(welcome_text, reply_markup=builder.as_markup(), parse_mode=ParseMode.MARKDOWN)

# Запуск
async def main():
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        logger.info("🚀 Бот запущен и готов к работе!")
        await dp.start_polling(bot)
    except TelegramConflictError:
        logger.error("❌ Ошибка: Бот уже запущен в другом процессе!")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())
