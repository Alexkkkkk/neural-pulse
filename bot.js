import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { User, logger } from './db.js'; // Убедись, что логгер импортируется правильно

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// 1. МГНОВЕННЫЙ ОБРАБОТЧИК ВЕБХУКА (Решает 504)
app.post(`/telegraf/${BOT_TOKEN}`, express.json(), (req, res) => {
    logger.info(`[TG] Входящий пакет данных`);
    res.sendStatus(200); // Сразу отвечаем Telegram "OK"
    bot.handleUpdate(req.body); // Обрабатываем логику в фоне
});

app.use(cors());
app.use('/api', express.json());
app.use(express.static(path.join(__dirname, 'static')));

// 2. ПРОКСИ ДЛЯ АДМИНКИ
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    onError: (err, req, res) => {
        logger.warn("[PROXY] Админка еще грузится...");
        res.status(502).send("<h1>Система загружается... Подождите 30 сек.</h1>");
    }
}));

// 3. ЛОГИКА БОТА
bot.start(async (ctx) => {
    logger.info(`[CMD] /start от ${ctx.from.id}`);
    try {
        const [user] = await User.findOrCreate({ 
            where: { id: BigInt(ctx.from.id) },
            defaults: { username: ctx.from.username || 'AGENT' }
        });
        await ctx.reply(`⚡ Neural Pulse: Online\nАгент: ${user.username}`);
    } catch (e) { logger.error(`[ERR] ${e.message}`); }
});

app.listen(PORT, '0.0.0.0', () => {
    logger.system(`[BOT] Шлюз на порту ${PORT} запущен.`);
});
