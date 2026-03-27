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

// Middleware для JSON и статики
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- ТЕСТОВЫЙ МАРШРУТ ---
app.get('/test', (req, res) => res.send("<h1>SERVER IS ALIVE!</h1>"));

// --- ЛОГИКА БОТА ---
bot.start(async (ctx) => {
    console.log(`[${new Date().toISOString()}] !!! ПОЛУЧЕН СТАРТ от ${ctx.from.id} !!!`);
    try {
        await ctx.reply("Система Neural Pulse активирована!");
    } catch (e) {
        console.error("Ошибка ответа бота:", e.message);
    }
});

// --- ИСПРАВЛЕННЫЙ ВЕБХУК (РЕШАЕТ 504 ОШИБКУ) ---
app.post('/', async (req, res) => {
    console.log("📥 [ВХОДЯЩИЙ POST] Telegram прислал данные...");
    
    try {
        // 1. Мгновенно отвечаем Telegram "200 OK", чтобы не было таймаута (504)
        res.sendStatus(200);

        // 2. Обрабатываем сообщение в фоновом режиме
        await bot.handleUpdate(req.body);
    } catch (err) {
        console.error("❌ Ошибка при обработке Update:", err.message);
        // Даже при ошибке мы уже отправили 200, чтобы очередь не забивалась
    }
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(PORT, '0.0.0.0', async () => {
    try {
        // Удаляем старый вебхук и сбрасываем зависшие сообщения
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log("♻️ Очередь обновлений сброшена.");

        // Устанавливаем новый вебхук на корень домена
        await bot.telegram.setWebhook(`${DOMAIN}/`);
        
        console.log(`🚀 SYSTEM: Online on port ${PORT}`);
        console.log(`🔗 WEBHOOK URL: ${DOMAIN}/`);
    } catch (err) {
        console.error("STARTUP ERROR:", err);
    }
});
