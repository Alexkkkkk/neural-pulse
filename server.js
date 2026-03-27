import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";

const bot = new Telegraf(BOT_TOKEN);

// --- ЛОГИКА СТАРТА ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const photoPath = path.join(__dirname, 'static/images/logo.png');

    console.log(`[${new Date().toISOString()}] 📥 Команда /start от: ${userId}`);

    try {
        await ctx.replyWithPhoto({ source: photoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nРежим Long Polling (Прямое подключение).\n\nВаш ID: <code>${userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback("⚡ ПРОВЕРКА СВЯЗИ", "test_btn")]])
        });
    } catch (e) {
        await ctx.reply("Система Online (без фото).");
        console.error(`Ошибка отправки:`, e.message);
    }
});

bot.action('test_btn', (ctx) => ctx.answerCbQuery("Связь установлена!"));

// --- ЗАПУСК БЕЗ EXPRESS (ДЛЯ ТЕСТА) ---
bot.launch()
    .then(() => console.log("🚀 Бот запущен в режиме Long Polling! Пиши ему в Telegram."))
    .catch((err) => console.error("❌ Ошибка запуска:", err));

// Мягкая остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
