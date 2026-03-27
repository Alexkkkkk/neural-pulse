import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- ТЕСТОВЫЙ МАРШРУТ ДЛЯ БРАУЗЕРА ---
// Зайди на https://np.bothost.tech/test , если увидишь "OK", значит сервер доступен извне
app.get('/test', (req, res) => res.send("<h1>SERVER IS ALIVE!</h1>"));

// --- ЛОГИКА БОТА ---
bot.start(async (ctx) => {
    console.log("!!! ПОЛУЧЕН СТАРТ !!!");
    try {
        await ctx.reply("Система Neural Pulse активирована!");
    } catch (e) {
        console.error("Ошибка ответа:", e);
    }
});

// --- ВЕБХУК НА КОРНЕВОЙ ПУТЬ ---
// Ставим вебхук просто на домен, без сложных путей
app.post('/', (req, res) => {
    console.log("📥 [ВХОДЯЩИЙ POST] Telegram стучится в дверь...");
    bot.handleUpdate(req.body, res);
});

app.listen(PORT, '0.0.0.0', async () => {
    try {
        // Очищаем и ставим на корень /
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        await bot.telegram.setWebhook(`${DOMAIN}/`);
        
        console.log(`🚀 SYSTEM: Online on port ${PORT}`);
        console.log(`🔗 WEBHOOK: ${DOMAIN}/`);
    } catch (err) {
        console.error("STARTUP ERROR:", err);
    }
});
