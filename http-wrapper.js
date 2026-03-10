const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = "8257287930:AAG4hbfu1mF55SghPkrzt3_CZgh3tuds3x0"; 
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse";
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

const app = express();
app.set('trust proxy', 1);
const bot = new Telegraf(API_TOKEN);

// --- [2. БАЗА ДАННЫХ] ---
let usersData = {};
function loadData() {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            logger.info(`📂 БД: Загружено профилей: ${Object.keys(usersData).length}`);
        }
    } catch (e) { logger.error(`📂 БД ERROR: ${e.message}`); }
}
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));
    } catch (e) { logger.error(`💾 БД ERROR: ${e.message}`); }
}

// --- [3. РОУТЫ И ВЕБХУК] ---
app.post(WEBHOOK_PATH, (req, res, next) => {
    logger.debug(`📡 WEBHOOK: Получен запрос от Telegram`);
    next();
}, bot.webhookCallback(WEBHOOK_PATH));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

// --- [4. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const username = ctx.from.username || "Agent";
    logger.info(`🎯 BOT: Обработка /start для ${uid}`);
    
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE AI</b>\n\nПривет, ${username}!\nТвой ID: <code>${uid}</code>\n\nНажми кнопку для входа в систему.`,
            Markup.inlineKeyboard([
                [Markup.button.webApp("ВХОД 🧠", `${WEB_APP_URL}/?u=${uid}`)],
                [Markup.button.url("КАНАЛ", "https://t.me/neural_pulse_news")]
            ])
        );
        logger.info(`✅ BOT: Сообщение отправлено пользователю ${uid}`);
    } catch (e) { logger.error(`❌ BOT ERROR: ${e.message}`); }
});

bot.on('text', (ctx) => ctx.reply("Система активна. Используй /start."));

// --- [5. ЗАПУСК] ---
loadData();
setInterval(saveData, 60000);

async function init() {
    try {
        const me = await bot.telegram.getMe();
        logger.info(`🤖 BOT: Авторизован как @${me.username}`);

        app.listen(PORT, '0.0.0.0', async () => {
            logger.info(`🌐 SERVER (HTTP-WRAPPER): Запущен на порту ${PORT}`);
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            logger.info(`🤖 BOT: Вебхук установлен на ${hookUrl}`);
        });
    } catch (e) {
        logger.error(`❌ FATAL: Ошибка авторизации бота: ${e.message}`);
    }
}

init();

process.on('SIGTERM', () => { saveData(); process.exit(0); });
