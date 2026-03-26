import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs'; 
import { createProxyMiddleware } from 'http-proxy-middleware';
import { User, Task, Stats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PORT = process.env.PORT || 3000;

logger.info(`[BOT_INIT] Запуск на порту ${PORT}...`);

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Логгер входящих HTTP запросов
app.use((req, res, next) => {
    if (!req.url.includes('telegraf')) logger.info(`[HTTP] ${req.method} ${req.url}`);
    next();
});

app.use(`/telegraf/${BOT_TOKEN}`, (req, res, next) => {
    logger.info(`[TG_WEBHOOK] Получено обновление от Telegram`);
    bot.webhookCallback(`/telegraf/${BOT_TOKEN}`)(req, res, next);
});

app.use(cors({ origin: '*' }));
app.use('/api', express.json());
app.use(express.static(path.join(__dirname, 'static')));

// ПРОКСИ ЛОГЕР
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    proxyTimeout: 45000,
    onProxyReq: (proxyReq, req) => logger.info(`[PROXY] Перенаправление в админку: ${req.url}`),
    onError: (err, req, res) => {
        logger.warn(`[PROXY_FAIL] Админка на 3001 еще не готова или упала: ${err.message}`);
        res.status(502).send('<h1>SYSTEM_BOOT: Подождите 30 сек, идет сборка AdminJS...</h1>');
    }
}));

bot.start(async (ctx) => {
    logger.info(`[BOT_CMD] Пользователь ${ctx.from.id} нажал /start`);
    try {
        const [user, created] = await User.findOrCreate({ 
            where: { id: BigInt(ctx.from.id) },
            defaults: { username: ctx.from.username || 'AGENT' }
        });
        logger.info(`[DB_OP] Пользователь ${ctx.from.id}: ${created ? 'СОЗДАН' : 'НАЙДЕН'}`);
        
        await ctx.reply("⚡ NEURAL PULSE ONLINE");
    } catch (e) {
        logger.error(`[BOT_ERR] Ошибка в команде start: ${e.message}`);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    logger.system(`[GATEWAY] Слушает порт ${PORT}. Готов к работе.`);
});
