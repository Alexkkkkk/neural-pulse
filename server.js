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
            // Если файл пустой, JSON.parse выдаст ошибку, поэтому проверяем контент
            usersData = raw.trim() ? JSON.parse(raw) : {};
            logger.info(`📦 БД: Загружено профилей: ${Object.keys(usersData).length}`);
        } else {
            usersData = {};
            logger.info("📦 БД: Файл не найден, создана новая база");
        }
    } catch (e) {
        logger.error("❌ БД LOAD ERROR (проверьте формат JSON): " + e.message);
        usersData = {}; // Сбрасываем в пустой объект, чтобы не падать
    }
}

function saveData() {
    try {
        // Сохраняем сначала во временный файл, чтобы не повредить основной при сбое
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

app.get('/', (req, res) => {
    res.status(200).send('Neural Pulse Core is Live');
});

// Обработка вебхука
app.post(WEBHOOK_PATH, express.json(), async (req, res) => {
    const updateId = req.body ? req.body.update_id : 'unknown';
    logger.debug(`📥 ВЕБХУК [ID:${updateId}]: Получен запрос`);

    try {
        if (req.body && req.body.update_id) {
            await bot.handleUpdate(req.body, res);
            logger.debug(`✅ ВЕБХУК [ID:${updateId}]: Обработан`);
        } else {
            res.sendStatus(200); 
        }
    } catch (e) {
        logger.error(`❌ ВЕБХУК [ID:${updateId}] ERROR: ${e.message}`);
        if (!res.headersSent) res.sendStatus(500);
    }
});

// Статические файлы и JSON парсинг для API
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

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
    
    if (uid && usersData[uid]) {
        if (score !== undefined) usersData[uid].balance = parseFloat(score);
        if (energy !== undefined) usersData[uid].energy = parseFloat(energy);
        usersData[uid].last_active = Math.floor(Date.now() / 1000);
        res.json({ status: "ok" });
    } else {
        res.status(404).json({ status: "error", message: "User not found" });
    }
});

setInterval(saveData, 60000);

// --- [5. БОТ] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE</b>\n\nПротокол активирован. Добро пожаловать!`, 
            Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrl)]])
        );
        logger.info(`✅ БОТ: /start выполнен для ${uid}`);
    } catch (e) {
        logger.error(`❌ БОТ START ERROR: ${e.message}`);
    }
});

bot.catch((err, ctx) => {
    logger.error(`🛑 TELEGRAF ERROR [Update:${ctx.update.update_id}]: ${err.message}`);
});

// --- [6. ЗАПУСК] ---
async function start() {
    loadData();
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 СЕРВЕР: Порт ${PORT}`);
        try {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            // Очищаем старые обновления и ставим вебхук
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            
            const info = await bot.telegram.getWebhookInfo();
            logger.info(`🤖 БОТ: Вебхук установлен на -> ${info.url}`);
            
            if (process.send) process.send('ready'); 
        } catch (err) {
            logger.error(`🤖 WEBHOOK SET ERROR: ${err.message}`);
        }
    });
}

const shutdown = () => {
    logger.warn("⚠️  Завершение работы...");
    saveData();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
