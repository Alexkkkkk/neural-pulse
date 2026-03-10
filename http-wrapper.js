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
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

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
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            logger.info(`📂 БД: Загружено профилей: ${Object.keys(usersData).length}`);
        }
    } catch (e) { 
        logger.error(`📂 БД ERROR: ${e.message}`); 
        usersData = {};
    }
}

function saveData() {
    try {
        const data = JSON.stringify(usersData, null, 2);
        fs.writeFileSync(DATA_FILE, data);
        logger.debug("💾 БД: Данные сохранены");
    } catch (e) { 
        logger.error(`💾 БД ERROR: ${e.message}`); 
    }
}

// --- [3. MIDDLEWARE И ВЕБХУК] ---
app.post(WEBHOOK_PATH, (req, res, next) => {
    logger.debug(`📡 WEBHOOK: POST запрос от Telegram`);
    next();
}, bot.webhookCallback(WEBHOOK_PATH));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

// --- [4. API ДЛЯ WEBAPP] ---
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000 };
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    if (uid && uid !== 'undefined') {
        if (!usersData[uid]) usersData[uid] = { id: uid, balance: 0, energy: 1000 };
        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        saveData(); // Сохраняем сразу при важном обновлении
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error", message: "Invalid ID" });
});

// --- [5. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const username = ctx.from.username || "User";
    logger.info(`🎯 BOT: Команда /start от ${uid}`);
    
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE AI</b>\n\nПривет, ${username}!\nТвой ID: <code>${uid}</code>\n\nБот работает через PM2 + http-wrapper.`,
            Markup.inlineKeyboard([
                [Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", `${WEB_APP_URL}/?u=${uid}`)],
                [Markup.button.url("КАНАЛ", "https://t.me/neural_pulse_news")]
            ])
        );
    } catch (e) { logger.error(`❌ BOT ERROR: ${e.message}`); }
});

bot.on('text', (ctx) => ctx.reply("Система активна. Напишите /start для входа."));

// --- [6. ЗАПУСК] ---
loadData();
setInterval(saveData, 60000); // Автосохранение каждую минуту

async function init() {
    try {
        const me = await bot.telegram.getMe();
        logger.info(`🤖 BOT: Авторизован как @${me.username}`);

        app.listen(PORT, '0.0.0.0', async () => {
            logger.info(`🌐 SERVER: Запущен на порту ${PORT}`);
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            
            logger.info(`🤖 BOT: Вебхук установлен: ${hookUrl}`);

            // СИГНАЛ ДЛЯ PM2 (если используется wait_ready: true)
            if (process.send) {
                process.send('ready');
                logger.info("🚀 PM2: Сигнал 'ready' отправлен");
            }
        });
    } catch (e) {
        logger.error(`❌ FATAL: Ошибка инициализации: ${e.message}`);
        process.exit(1);
    }
}

init();

// --- [7. ЗАВЕРШЕНИЕ РАБОТЫ] ---
const gracefulShutdown = () => {
    logger.info("⚠️ Завершение работы: сохранение данных...");
    saveData();
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
