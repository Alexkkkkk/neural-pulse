import os
import asyncio
import logging
import sys
import sqlite3  # Добавили для работы с БД
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, WebAppInfo, CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramConflictError

# --- НАСТРОЙКА ЛОГИРОВАНИЯ ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# --- КОНФИГУРАЦИЯ ---
TOKEN = os.getenv("BOT_TOKEN") or "8257287930:AAEV1sQMIIrPdcBeInwvmh7FD3xnp3b9DRI"
ADMIN_ID = os.getenv("ADMIN_ID", "476014374")
WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"
WEBAPP_URL = "https://ai.bothost.ru/" # Ссылка на корень, где теперь лежит index.html

# ПУТЬ К БАЗЕ ДАННЫХ (в папку /app/data из Docker)
DB_PATH = os.path.join("data", "database.db")

# --- ИНИЦИАЛИЗАЦИЯ БД ---
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Создаем таблицу пользователей, если её нет
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
    logger.info(f"✅ База данных инициализирована по пути: {DB_PATH}")

init_db()

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Таблица уровней
UPGRADES = {
    1: 0.5, 2: 1.0, 3: 1.5, 4: 2.0, 5: 3.0,
    6: 5.0, 7: 7.5, 8: 10.0, 9: 15.0, 10: 20.0,
    11: 30.0, 12: 40.0, 13: 50.0, 14: 65.0, 15: 80.0,
    16: 100.0, 17: 115.0, 18: 125.0, 19: 135.0, 20: 150.0
}

# --- ХЕНДЛЕРЫ ---

@dp.message(Command("start"))
async def start_command(message: types.Message):
    # Сохраняем пользователя в БД при старте
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)', 
                   (message.from_user.id, message.from_user.username))
    conn.commit()
    conn.close()

    welcome_text = (
        "💎 **NeuralPulse AI**\n\n"
        "Добро пожаловать! Зарабатывай токены, улучшай нейросеть и выводи прибыль.\n\n"
        f"💳 **Кошелек для активации:**\n`{WALLET}`"
    )
    
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(
        text="🎮 Запустить NeuralPulse App", 
        web_app=WebAppInfo(url=WEBAPP_URL)
    ))
    builder.row(InlineKeyboardButton(
        text="📈 Таблица уровней", callback_data="show_levels"
    ))

    await message.answer(welcome_text, reply_markup=builder.as_markup(), parse_mode=ParseMode.MARKDOWN)

@dp.callback_query(F.data == "show_levels")
async def show_levels(callback: CallbackQuery):
    text = "📊 **Стоимость улучшений (TON):**\n\n"
    for lvl, price in UPGRADES.items():
        text += f"Уровень {lvl} — {price} TON\n"
    await callback.answer()
    await callback.message.answer(text, parse_mode=ParseMode.MARKDOWN)

# --- ЗАПУСК ---
async def main():
    logger.info("🚀 ЗАПУСК БОТА NEURALPULSE С ПОДДЕРЖКОЙ БД")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    except TelegramConflictError:
        logger.error("❌ Конфликт: Бот запущен в другом месте!")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот остановлен")
