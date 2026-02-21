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
# Токен берется из переменных окружения Bothost (BOT_TOKEN) или используется запасной
TOKEN = os.getenv("BOT_TOKEN") or "8257287930:AAFb7BvbLCRncS80ZQX3frzafGlsLcwO0QQ"
ADMIN_ID = os.getenv("ADMIN_ID") or "476014374"
WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"
WEBAPP_URL = "https://ai.bothost.ru/" 

# Путь к базе данных (внутри папки /bot/data в контейнере)
DB_PATH = "data/bot_database.db"

def init_db():
    """Инициализация базы данных и создание папки, если её нет"""
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

# Инициализируем БД перед запуском бота
init_db()

# Создаем объекты бота и диспетчера
bot = Bot(token=TOKEN)
dp = Dispatcher()

# --- ОБРАБОТЧИКИ ---

@dp.message(Command("start"))
async def start_command(message: types.Message):
    """Регистрация пользователя и приветствие"""
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

@dp.message(Command("admin"))
async def admin_command(message: types.Message):
    """Простая админ-панель"""
    if str(message.from_user.id) == str(ADMIN_ID):
        conn = sqlite3.connect(DB_PATH)
        count = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        conn.close()
        await message.answer(f"🛠 **Панель управления**\n\nИгроков в базе: {count}\nСистема: OK")
    else:
        await message.answer("❌ Доступ закрыт.")

# --- ЗАПУСК ---

async def main():
    """Основная функция запуска с защитой от конфликтов"""
    try:
        # Принудительно удаляем вебхук и старые обновления перед началом
        logger.info("Удаление старых вебхуков и обновлений...")
        await bot.delete_webhook(drop_pending_updates=True)
        
        logger.info("🚀 Бот запущен и готов к работе!")
        
        # Запуск polling (опроса серверов)
        await dp.start_polling(bot)
        
    except TelegramConflictError:
        logger.error("❌ КОНФЛИКТ: Бот запущен в другом месте!")
        logger.info("РЕШЕНИЕ: Остановите все копии бота в панели Bothost, подождите 1 минуту и запустите снова.")
        # Завершаем процесс, чтобы не создавать лишнюю нагрузку при конфликте
        sys.exit(1)
    except Exception as e:
        logger.error(f"⚠️ Произошла ошибка: {e}")
    finally:
        # Закрываем сессию при выключении
        await bot.session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот выключен вручную")
