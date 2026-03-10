const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAGb0-TC4z3uFK2glOUJeU_wHnr27474zzQ";
const WEB_APP_URL = process.env.WEB_APP_URL || "https://np.bothost.ru"; 
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse"; 
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

// Настройка красивых логов для панели Bothost
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
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            logger.info(`📂 БД: Успешно загружено профилей: ${Object.keys(usersData).length}`);
        } else {
            logger.info("📂 БД: Файл не найден, создаем новую базу");
            usersData = {};
        }
    } catch (e) {
        logger.error(`📂 БД ERROR: ${e.message}`);
        usersData = {}; 
    }
}

function saveData() {
    try {
        // Атомарное сохранение (через временный файл), чтобы не повредить JSON при сбое
        const tempFile = DATA_FILE + '.tmp';
        fs.writeFileSync(tempFile, JSON.stringify(usersData, null, 2), 'utf8');
        fs.renameSync(tempFile, DATA_FILE);
        logger.debug("💾 БД: Данные синхронизированы");
    } catch (e) {
        logger.error(`💾 БД ERROR: ${e.message}`);
    }
}

// --- [3. ПРОВЕРКА ПОДЛИННОСТИ (AUTH)] ---
function validateInitData(initData) {
    if (!initData) return false;
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckString = Array.from(urlParams.entries())
            .map(([key, value]) => `${key}=${value}`)
            .sort()
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(API_TOKEN)
            .digest();

        const hmac = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        return hmac === hash;
    } catch (e) {
        return false;
    }
}

// --- [4. MIDDLEWARE & API] ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'static')));

// ВАЖНО: Подключаем обработку вебхука Telegraf как middleware
app.use(bot.webhookCallback(WEBHOOK_PATH));

const getBaseProfile = (uid) => ({
    id: uid, 
    balance: 0, 
    click_lvl: 1, 
    pnl: 0, 
    energy: 1000, 
    max_energy: 1000, 
    last_active: Math.floor(Date.now() / 1000)
});

// API: Получение данных пользователя
app.get('/api/balance/:userId', (req, res) => {
    try {
        const uid = String(req.params.userId);
        if (!usersData[uid]) {
            usersData[uid] = getBaseProfile(uid);
        }
        res.json({ status: "ok", data: usersData[uid] });
    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

// API: Сохранение прогресса
app.post('/api/save', (req, res) => {
    try {
        const { user_id, score, energy } = req.body;
        const uid = String(user_id);
        const authHeader = req.headers['authorization'];

        if (!validateInitData(authHeader)) {
            logger.warn(`⚠️ AUTH: Подозрительный запрос от ${uid}`);
        }

        if (uid && uid !== 'undefined' && uid !== 'null') {
            if (!usersData[uid]) usersData[uid] = getBaseProfile(uid);
            
            if (score !== undefined) usersData[uid].balance = Number(score);
            if (energy !== undefined) usersData[uid].energy = Number(energy);
            usersData[uid].last_active = Math.floor(Date.now() / 1000);
            
            res.json({ status: "ok" });
        } else {
            res.status(400).json({ status: "error", message: "Invalid ID" });
        }
    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

// --- [5. ЛОГИКА ТЕЛЕГРАМ БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}`;
    
    logger.info(`🎯 BOT: Команда /start от ${uid}`);
    
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE AI</b>\n\nСистема инициализирована. Добро пожаловать, агент <code>${uid}</code>.\n\nТвоя задача: добывать нейро-токены. Энергия ограничена!`,
            Markup.inlineKeyboard([
                [Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", webAppUrl)],
                [Markup.button.url("КАНАЛ ПРОЕКТА", "https://t.me/neural_pulse_news")]
            ])
        );
    } catch (e) {
        logger.error(`🎯 BOT REPLY ERROR: ${e.message}`);
    }
});

// --- [6. ЗАПУСК И ЗАВЕРШЕНИЕ] ---
async function startServer() {
    loadData();

    app.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 SERVER: Запущен на порту ${PORT}`);
        try {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            // Очищаем старые "зависшие" сообщения и ставим вебхук
            await bot.telegram.setWebhook(hookUrl, { drop_pending_updates: true });
            logger.info(`🤖 BOT: Вебхук успешно установлен на ${hookUrl}`);
        } catch (err) {
            logger.error(`🤖 BOT ERROR: Ошибка вебхука: ${err.message}`);
        }
    });
}

// Автосохранение базы каждые 60 секунд
const saveInterval = setInterval(saveData, 60000);

// Корректное завершение при перезагрузке сервера Bothost
const handleShutdown = async (signal) => {
    logger.warn(`🛑 SYSTEM: Получен сигнал ${signal}. Выключение...`);
    clearInterval(saveInterval);
    saveData();
    try {
        await bot.stop(signal);
    } catch (e) {}
    process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();
