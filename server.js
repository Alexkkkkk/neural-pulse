const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAGb0-TC4z3uFK2glOUJeU_wHnr27474zzQ";
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
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

// --- [2. БАЗА ДАННЫХ (JSON)] ---
let usersData = {};

function loadData() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            if (raw.trim()) {
                usersData = JSON.parse(raw);
                logger.info(`📦 БД: Загружено профилей: ${Object.keys(usersData).length}`);
            } else {
                usersData = {};
                logger.info("📦 БД: Файл пуст, инициализирована пустая база");
            }
        } else {
            usersData = {};
            logger.info("📦 БД: Файл не найден, создана новая база");
        }
    } catch (e) {
        logger.error("❌ БД LOAD ERROR: " + e.message);
        usersData = {}; 
    }
}

function saveData() {
    try {
        const tmpFile = DATA_FILE + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(usersData, null, 2), 'utf8');
        fs.renameSync(tmpFile, DATA_FILE);
        logger.debug("💾 БД: Данные синхронизированы успешно");
    } catch (e) {
        logger.error("❌ БД SAVE ERROR: " + e.message);
    }
}

// --- [3. MIDDLEWARE & WEBHOOK] ---
app.use(cors());
app.use(express.json()); // Обязательно перед роутами
app.use(express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
    res.status(200).send('Neural Pulse Core is Live');
});

// ОБРАБОТКА ВЕБХУКА (Критический узел)
app.post(WEBHOOK_PATH, async (req, res) => {
    // Сразу отвечаем Telegram, чтобы он не слал повторы
    res.sendStatus(200);

    try {
        if (req.body && req.body.update_id) {
            logger.debug(`📥 ВЕБХУК: Получен апдейт ID ${req.body.update_id}`);
            await bot.handleUpdate(req.body);
        }
    } catch (e) {
        logger.error(`❌ ВЕБХУК ERROR: ${e.message}`);
    }
});

// --- [4. API] ---
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
    if (uid && uid !== 'undefined') {
        if (!usersData[uid]) usersData[uid] = { id: uid, balance: 0, energy: 1000 };
        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        usersData[uid].last_active = Math.floor(Date.now() / 1000);
        res.json({ status: "ok" });
    } else {
        res.status(400).json({ status: "error", message: "Invalid user_id" });
    }
});

setInterval(saveData, 60000);

// --- [5. БОТ] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
    logger.info(`🎯 БОТ: Получена команда /start от ${uid}`);
    
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE</b>\n\nСистема инициализирована. Добро пожаловать, агент.`, 
            Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrl)]])
        );
    } catch (e) {
        logger.error(`❌ БОТ REPLY ERROR: ${e.message}`);
    }
});

// --- [6. ЗАПУСК] ---
async function start() {
    loadData();
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 СЕРВЕР: Запущен на порту ${PORT}`);
        try {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            // Очищаем старые сообщения и ставим вебхук заново
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            
            const info = await bot.telegram.getWebhookInfo();
            logger.info(`🤖 БОТ: Вебхук установлен: ${info.url}`);
            
            if (process.send) process.send('ready'); 
        } catch (err) {
            logger.error(`🤖 WEBHOOK ERROR: ${err.message}`);
        }
    });
}

const shutdown = () => {
    logger.warn("⚠️ Завершение работы...");
    saveData();
    setTimeout(() => process.exit(0), 500);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
