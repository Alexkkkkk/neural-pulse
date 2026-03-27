import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
// import cors from 'cors';
// import session from 'express-session';
// import { Sequelize, DataTypes, Op } from 'sequelize';
// import os from 'os';

// --- ADMINJS ВЫКЛЮЧЕН ---
// import AdminJS from 'adminjs';
// import AdminJSExpress from '@adminjs/express';
// import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = {
    info: (msg) => console.log(`[${new Date().toISOString()}] 🔵 INFO: ${msg}`),
    system: (msg) => console.log(`[${new Date().toISOString()}] 🚀 SYSTEM: ${msg}`),
    error: (msg, err) => console.error(`[${new Date().toISOString()}] 🔴 ERROR: ${msg}`, err || '')
};

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- СЕРВЕР И СТАТИКА ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- ТОЛЬКО ЛОГИКА СТАРТА ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const photoPath = path.join(__dirname, 'static/images/logo.png');

    logger.info(`Bot /start received from: ${userId}`);

    try {
        // Отправляем только приветствие и кнопку WebApp
        await ctx.replyWithPhoto({ source: photoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nСистема активна. Режим проверки отклика.\n\nID: <code>${userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
        });
    } catch (e) {
        // Если фото не найдено, просто текст
        await ctx.reply("Neural Pulse: System Online.", Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]]));
        logger.error(`Start reply failed`, e);
    }
});

// --- WEBHOOK SETUP ---
const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- ЗАПУСК ---
app.listen(PORT, '0.0.0.0', async () => {
    try {
        // Устанавливаем вебхук при запуске
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        logger.system(`Bypass Mode: Bot is listening on port ${PORT}`);
    } catch (err) {
        logger.error("Startup Failure", err);
    }
});

// Остальные функции (БД, ИИ, Админка, API) полностью закомментированы выше или удалены для чистоты теста.
