import os
import asyncio
import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, WebAppInfo, CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.enums import ParseMode

# Настройка логов
logging.basicConfig(level=logging.INFO)

# --- ДАННЫЕ УСТАНОВЛЕНЫ ---
TOKEN = "8257287930:AAHunzQOMoGHBlL_L5VVnwrkU3F24uzpJe8"
ADMIN_ID = "476014374"
WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"

# Ссылка на твой интерфейс (убедись, что она верная)
WEBAPP_URL = "https://alexkkkkk.github.io/neural-pulse/"

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Экономика: 20 уровней (Чистые отступы)
UPGRADES = {
    1: 0.5, 2: 1.0, 3: 1.5, 4: 2.0, 5: 3.0,
    6: 5.0, 7: 7.5, 8: 10.0, 9: 15.0, 10: 20.0,
    11: 30.0, 12: 40.0, 13: 50.0, 14: 65.0, 15: 80.0,
    16: 100.0, 17: 115.0, 18: 125.0, 19: 135.0, 20: 150.0
}

@dp.message(Command("start"))
async def start_command(message: types.Message):
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

    await message.answer(
        welcome_text, 
        reply_markup=builder.as_markup(), 
        parse_mode=ParseMode.MARKDOWN
    )

@dp.callback_query(F.data == "show_levels")
async def show_levels(callback: CallbackQuery):
    text = "📊 **Стоимость улучшений (TON):**\n\n"
    for lvl, price in UPGRADES.items():
        text += f"Уровень {lvl} — {price} TON\n"
    
    await callback.answer()
    await callback.message.answer(text, parse_mode=ParseMode.MARKDOWN)

@dp.message(Command("admin"))
async def admin_command(message: types.Message):
    if str(message.from_user.id) == ADMIN_ID:
        await message.answer("🛠 **Панель администратора NeuralPulse**\n\nВсе системы работают в штатном режиме.")
    else:
        await message.answer(f"❌ Доступ ограничен. Твой ID: `{message.from_user.id}`")

async def main():
    logging.info("Бот NeuralPulse запускается...")
    await bot.delete_webhook(drop_pending_updates=True)
    logging.info("Бот готов к работе!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
