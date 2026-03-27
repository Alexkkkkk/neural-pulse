import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Уникальный путь для вебхука (как в твоих прошлых рабочих версиях)
const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- ПОДКЛЮЧЕНИЕ ВЕБХУКА ---
// Используем встроенный метод, он сам отвечает 200 OK в Telegram
app.use(bot.webhookCallback(WEBHOOK_PATH));

// Тестовый маршрут для проверки через браузер
app.get('/test', (req, res) => res.send("<h1>SERVER IS ALIVE!</h1>"));

// --- ЛОГИКА БОТА ---
bot.start(async (ctx) => {
    console.log(`[!] ПОЛУЧЕН /START ОТ: ${ctx.from.id}`);
    const photoPath = path.join(__dirname, 'static/images/logo.png');

    try {
        // Пробуем отправить фото с твоим дизайном
        await ctx.replyWithPhoto({ source: photoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nСистема инициализирована.\nСвязь установлена успешно.`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
        });
    } catch (e) {
        // Если фото не найдено, отправляем текст
        console.error("Ошибка фото:", e.message);
        await ctx.reply("Neural Pulse: System Online.", Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]]));
    }
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Шаг 1: Сервер запущен на порту ${PORT}`);
    
    // Даем хостингу 5 секунд "продышаться"
    setTimeout(async () => {
        try {
            console.log("🚀 Шаг 2: Очистка старых вебхуков...");
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            
            console.log("🚀 Шаг 3: Регистрация нового Webhook...");
            const fullUrl = `${DOMAIN}${WEBHOOK_PATH}`;
            const success = await bot.telegram.setWebhook(fullUrl);
            
            if (success) {
                console.log(`✅ СИСТЕМА ГОТОВА: ${fullUrl}`);
            } else {
                console.error("❌ Telegram отклонил Webhook");
            }
        } catch (err) {
            console.error("❌ ОШИБКА НАСТРОЙКИ:", err.message);
        }
    }, 5000);
});
