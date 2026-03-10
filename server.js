const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAG4hbfu1mF55SghPkrzt3_CZgh3tuds3x0";
const WEB_APP_URL = process.env.WEB_APP_URL || "https://np.bothost.ru";
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
    logger.info("📂 БД: Загрузка данных...");
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            logger.info(`📂 БД: Загружено профилей: ${Object.keys(usersData).length}`);
        }
    } catch (e) { logger.error(`📂 БД ERROR: ${e.message}`); }
}
function saveData() {
    try {
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(usersData, null, 2));
        fs.renameSync(tmp, DATA_FILE);
        logger.debug("💾 БД: Синхронизация завершена");
    } catch (e) { logger.error(`💾 БД ERROR: ${e.message}`); }
}

// --- [3. ОБРАБОТКА ВЕБХУКА] ---
// Ставим до body-parser, чтобы Telegraf сам читал поток
app.post(WEBHOOK_PATH, (req, res, next) => {
    logger.debug(`📡 WEBHOOK: Получен POST от Telegram`);
    next();
}, bot.webhookCallback(WEBHOOK_PATH));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

// --- [4. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const username = ctx.from.username || "Агент";
    logger.info(`🎯 BOT: Обработка /start для ${username} (ID: ${uid})`);
    
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}`;
    
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE AI</b>\n\nПривет, ${username}!\nТвой ID: <code>${uid}</code>\n\nНажми кнопку, чтобы запустить модуль.`,
            Markup.inlineKeyboard([
                [Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", webAppUrl)],
                [Markup.button.url("КАНАЛ", "https://t.me/neural_pulse_news")]
            ])
        );
        logger.info(`✅ BOT: Сообщение успешно доставлено пользователю ${uid}`);
    } catch (e) {
        logger.error(`❌ BOT ERROR: Не удалось отправить сообщение для ${uid}. Причина: ${e.message}`);
    }
});

bot.on('text', (ctx) => {
    logger.debug(`📩 BOT: Текст от ${ctx.from.id}: ${ctx.text}`);
    ctx.reply("Система активна. Используйте /start для входа.");
});

// --- [5. API] ---
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, last_active: Date.now() };
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
        logger.debug(`📡 API SAVE: Профиль ${uid} обновлен.`);
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error", message: "Invalid user_id" });
});

// --- [6. ЗАПУСК] ---
loadData();
setInterval(saveData, 60000);

async function init() {
    try {
        const me = await bot.telegram.getMe();
        logger.info(`🤖 BOT: Авторизован как @${me.username} (ID: ${me.id})`);

        app.listen(PORT, '0.0.0.0', async () => {
            logger.info(`🌐 SERVER: Слушает порт ${PORT}`);
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            logger.info(`🤖 BOT: Вебхук установлен: ${hookUrl}`);
        });
    } catch (e) {
        logger.error(`❌ FATAL ERROR: ${e.message}`);
    }
}

init();

process.on('SIGTERM', () => { saveData(); process.exit(0); });
process.on('SIGINT', () => { saveData(); process.exit(0); });
