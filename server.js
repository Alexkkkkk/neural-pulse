const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAGb0-TC4z3uFK2glOUJeU_wHnr27474zzQ";
const WEB_APP_URL = "https://np.bothost.ru"; 
const PORT = process.env.PORT || 3000;
// Путь вебхука должен СТРОГО совпадать с тем, что видит прокси хостинга
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
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

// --- [2. БАЗА ДАННЫХ (JSON-хранилище для стабильности)] ---
// Это заменяет sqlite3, который вызывает ошибку "Build Failed"
let usersData = {};

function loadData() {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            usersData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            logger.info("📦 БД: Данные загружены из JSON");
        }
    } catch (e) {
        logger.error("❌ БД LOAD ERROR: " + e.message);
        usersData = {};
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));
        logger.info("💾 БД: Сохранение выполнено");
    } catch (e) {
        logger.error("❌ БД SAVE ERROR: " + e.message);
    }
}

// --- [3. MIDDLEWARE & WEBHOOK] ---
app.use(cors());

// Вебхук обрабатываем ПЕРЕД общим express.json()
app.post(WEBHOOK_PATH, express.json(), async (req, res) => {
    try {
        if (req.body && req.body.update_id) {
            await bot.handleUpdate(req.body, res);
        } else {
            res.sendStatus(200);
        }
    } catch (e) {
        logger.error(`❌ WEBHOOK ERROR: ${e.message}`);
        res.sendStatus(500);
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- [4. API ДЛЯ ИГРЫ] ---
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { 
            id: uid, balance: 100, click_lvl: 1, pnl: 10, 
            energy: 1000, max_energy: 1000, last_active: Math.floor(Date.now() / 1000) 
        };
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    if (usersData[uid]) {
        usersData[uid].balance = parseFloat(score);
        usersData[uid].energy = parseFloat(energy);
        usersData[uid].last_active = Math.floor(Date.now() / 1000);
        res.json({ status: "ok" });
    } else {
        res.status(404).json({ status: "error", message: "User not found" });
    }
});

// Авто-сохранение каждые 30 секунд
setInterval(saveData, 30000);

// --- [5. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    logger.info(`🤖 BOT: Обработка /start от ${uid}`);
    try {
        const webAppUrl = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE</b>\n\nПротокол активирован.`, 
            Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrl)]])
        );
    } catch (e) {
        logger.error(`❌ BOT ERROR: ${e.message}`);
    }
});

// --- [6. ЗАПУСК] ---
async function start() {
    loadData();
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 СЕРВЕР: LIVE на порту ${PORT}`);
        try {
            // Установка вебхука на правильный путь
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            await bot.telegram.setWebhook(hookUrl, { drop_pending_updates: true });
            logger.info(`🤖 БОТ: Вебхук установлен на -> ${hookUrl}`);
        } catch (err) {
            logger.error(`🤖 WEBHOOK SET ERROR: ${err.message}`);
        }
    });
}

// Завершение работы
const shutdown = () => {
    saveData();
    process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
