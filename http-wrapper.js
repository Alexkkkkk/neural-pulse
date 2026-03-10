const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [КОНФИГУРАЦИЯ] ---
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

// --- [БАЗА ДАННЫХ] ---
let usersData = {};
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            logger.info("📂 БД: Данные успешно загружены.");
        }
    } catch (e) { logger.error("📂 БД ERROR: " + e.message); }
}
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));
        logger.debug("💾 БД: Сохранение завершено.");
    } catch (e) { logger.error("💾 БД ERROR: " + e.message); }
}

// --- [API И МАРШРУТЫ] ---
app.post(WEBHOOK_PATH, (req, res, next) => {
    logger.debug("📡 WEBHOOK: Запрос от Telegram");
    next();
}, bot.webhookCallback(WEBHOOK_PATH));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) usersData[uid] = { id: uid, balance: 0, energy: 1000 };
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    if (uid && usersData[uid]) {
        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        saveData();
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// --- [ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    await ctx.replyWithHTML(
        `🦾 <b>NEURAL PULSE AI</b>\n\nСистема запущена в обход ограничений хостинга.\nТвой ID: <code>${uid}</code>`,
        Markup.inlineKeyboard([
            [Markup.button.webApp("ВХОД 🧠", `${WEB_APP_URL}/?u=${uid}`)],
            [Markup.button.url("КАНАЛ", "https://t.me/neural_pulse_news")]
        ])
    );
});

// --- [ЗАПУСК] ---
loadData();
setInterval(saveData, 60000);

async function init() {
    try {
        app.listen(PORT, '0.0.0.0', async () => {
            logger.info(`🌐 SERVER: Активен на порту ${PORT}`);
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(`${WEB_APP_URL}${WEBHOOK_PATH}`);
            
            // Важный сигнал для PM2
            if (process.send) process.send('ready');
        });
    } catch (e) { logger.error("❌ FATAL: " + e.message); }
}

init();

process.on('SIGTERM', () => { saveData(); process.exit(0); });
