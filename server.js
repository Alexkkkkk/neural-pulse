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
            usersData = JSON.parse(raw || '{}');
            logger.info(`📦 БД: Загружено профилей: ${Object.keys(usersData).length}`);
        }
    } catch (e) {
        logger.error("❌ БД LOAD ERROR: " + e.message);
        usersData = {};
    }
}

function saveData() {
    try {
        const tmpFile = DATA_FILE + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(usersData, null, 2));
        fs.renameSync(tmpFile, DATA_FILE);
        logger.info("💾 БД: Данные синхронизированы");
    } catch (e) {
        logger.error("❌ БД SAVE ERROR: " + e.message);
    }
}

// --- [3. MIDDLEWARE & WEBHOOK] ---
app.use(cors());

// Health check
app.get('/', (req, res) => {
    logger.debug("🔍 HEALTH: Запрос на корень /");
    res.status(200).send('Neural Pulse Core is Live');
});

// Вебхук Telegram с детальным логированием
app.post(WEBHOOK_PATH, express.json(), async (req, res) => {
    const updateId = req.body ? req.body.update_id : 'unknown';
    logger.debug(`📥 ВЕБХУК [ID:${updateId}]: Получен входящий POST запрос`);

    try {
        if (req.body && req.body.update_id) {
            // Логируем тип обновления (message, callback_query и т.д.)
            const updateType = Object.keys(req.body).find(key => key !== 'update_id');
            logger.debug(`📥 ВЕБХУК [ID:${updateId}]: Тип события - ${updateType}`);
            
            await bot.handleUpdate(req.body, res);
            logger.debug(`✅ ВЕБХУК [ID:${updateId}]: Успешно обработан Telegraf`);
        } else {
            logger.warn(`⚠️ ВЕБХУК: Получен пустой или некорректный JSON`);
            res.sendStatus(200); // Telegram требует 200, даже если тело пустое
        }
    } catch (e) {
        logger.error(`❌ ВЕБХУК [ID:${updateId}] ERROR: ${e.message}`);
        if (!res.headersSent) res.sendStatus(500);
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- [4. API] ---
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    logger.debug(`📡 API GET: Запрос баланса пользователя ${uid}`);
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
    logger.debug(`📡 API POST: Сохранение данных пользователя ${uid}`);
    
    if (uid && usersData[uid]) {
        if (score !== undefined) usersData[uid].balance = parseFloat(score);
        if (energy !== undefined) usersData[uid].energy = parseFloat(energy);
        usersData[uid].last_active = Math.floor(Date.now() / 1000);
        res.json({ status: "ok" });
    } else {
        logger.warn(`📡 API POST: Ошибка сохранения, пользователь ${uid} не найден`);
        res.status(404).json({ status: "error", message: "User not found or invalid ID" });
    }
});

setInterval(saveData, 60000);

// --- [5. БОТ] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    logger.info(`🤖 БОТ: Выполнение команды /start для пользователя ${uid}`);
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE</b>\n\nПротокол активирован. Добро пожаловать!`, 
            Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrl)]])
        );
        logger.info(`✅ БОТ: Ответ на /start отправлен пользователю ${uid}`);
    } catch (e) {
        logger.error(`❌ БОТ START ERROR [User:${uid}]: ${e.message}`);
    }
});

// Глобальный перехват ошибок Telegraf
bot.catch((err, ctx) => {
    logger.error(`🛑 TELEGRAF ERROR [Update:${ctx.update.update_id}]: ${err.message}`);
});

// --- [6. ЗАПУСК] ---
async function start() {
    loadData();
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 СЕРВЕР: Слушает порт ${PORT}`);
        try {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            // Сначала удаляем старый вебхук на всякий случай
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            // Ставим новый
            await bot.telegram.setWebhook(hookUrl);
            
            const info = await bot.telegram.getWebhookInfo();
            logger.info(`🤖 БОТ: Вебхук успешно установлен на -> ${info.url}`);
            
            if (process.send) process.send('ready'); 
        } catch (err) {
            logger.error(`🤖 WEBHOOK SET ERROR: ${err.message}`);
        }
    });
}

const shutdown = () => {
    logger.warn("⚠️  Остановка сервера...");
    saveData();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
