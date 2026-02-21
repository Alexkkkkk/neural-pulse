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

# --- ЛОГИРОВАНИЕ ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# --- КОНФИГУРАЦИЯ ---
# Используем токены из переменных окружения (маппинг мы сделали в wrapper)
TOKEN = os.getenv("API_TOKEN") or "8257287930:AAEHbV8293ytnKQAFkc5kNzQCJCJzAnGsSg"
ADMIN_ID = os.getenv("ADMIN_ID") or "476014374"
WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"
WEBAPP_URL = "https://ai.bothost.ru/" 

# Путь к БД в созданную Docker-папку
DB_PATH = "/app/data/bot_database.db"

# --- БД ИНИЦИАЛИЗАЦИЯ ---
def init_db():
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
    logger.info("✅ База данных инициализирована в /app/data/")

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

# --- ОБРАБОТЧИКИ ---

@dp.message(Command("start"))
async def start_command(message: types.Message):
    # Сохраняем игрока
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
    builder.row(InlineKeyboardButton(text="📊 Уровни", callback_data="show_levels"))

    await message.answer(welcome_text, reply_markup=builder.as_markup(), parse_mode=ParseMode.MARKDOWN)

@dp.callback_query(F.data == "show_levels")
async def show_levels(callback: CallbackQuery):
    text = "📊 **Стоимость улучшений (TON):**\n\n"
    for lvl, price in UPGRADES.items():
        text += f"Уровень {lvl} — {price} TON\n"
    await callback.answer()
    await callback.message.answer(text, parse_mode=ParseMode.MARKDOWN)

@dp.message(Command("admin"))
async def admin_command(message: types.Message):
    if str(message.from_user.id) == str(ADMIN_ID):
        conn = sqlite3.connect(DB_PATH)
        count = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        conn.close()
        await message.answer(f"🛠 **Панель управления**\n\nИгроков в базе: {count}\nСистема: OK")
    else:
        await message.answer("❌ Доступ закрыт.")

# --- ЗАПУСК ---
async def main():
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        logger.info("🚀 Бот запущен и готов к работе!")
        await dp.start_polling(bot)
    except TelegramConflictError:
        logger.error("❌ Ошибка: Бот запущен в другом месте!")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот выключен")
