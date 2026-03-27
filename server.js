import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- НАСТРОЙКИ (ПРОВЕРЬТЕ ТОКЕН!) ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Логирование запросов для отладки
app.use(express.json());
app.use((req, res, next) => {
    if (req.url.includes('telegraf')) {
        console.log(`[${new Date().toISOString()}] 📥 Входящий запрос от Telegram`);
    }
    next();
});

// Раздача статики (ваши картинки и дизайн)
app.use(express.static(path.join(__dirname, 'static')));

// --- ЛОГИКА БОТА ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const photoPath = path.join(__dirname, 'static/images/logo.png');

    console.log(`[LOG] Пользователь ${userId} нажал START`);

    try {
        await ctx.replyWithPhoto({ source: photoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nСистема инициализирована через Webhook.\n\nВаш ID: <code>${userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
        });
    } catch (e) {
        console.error("Ошибка при отправке фото, отправляю текст:", e.message);
        await ctx.reply("System Online.", Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]]));
    }
});

// --- НАСТРОЙКА WEBHOOK ---
const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;

// Это связывает Express и Telegraf
app.post(WEBHOOK_PATH, (req, res) => {
    bot.handleUpdate(req.body, res);
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', async () => {
    try {
        const fullWebhookUrl = `${DOMAIN}${WEBHOOK_PATH}`;
        await bot.telegram.setWebhook(fullWebhookUrl);
        
        console.log(`🚀 SYSTEM: Сервер запущен на порту ${PORT}`);
        console.log(`🔗 WEBHOOK: Установлен на ${fullWebhookUrl}`);
    } catch (err) {
        console.error("❌ КРИТИЧЕСКАЯ ОШИБКА ПРИ СТАРТЕ:", err);
    }
});
