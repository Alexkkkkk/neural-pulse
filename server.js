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

// Настройка Winston для детального логирования в консоль Bothost
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
    logger.info("📂 БД: Запуск загрузки данных...");
    try {
        if (!fs.existsSync(DATA_DIR)) {
            logger.warn(`📂 БД: Директория ${DATA_DIR} не найдена, создаем...`);
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            logger.info(`📂 БД: Успешно прочитано. Профилей в памяти: ${Object.keys(usersData).length}`);
        } else {
            logger.info("📂 БД: Файл users.json отсутствует, инициализирована пустая база.");
            usersData = {};
        }
    } catch (e) {
        logger.error(`📂 БД ERROR: Ошибка при чтении: ${e.message}`);
        usersData = {};
    }
}

function saveData() {
    logger.debug("💾 БД: Подготовка к синхронизации с диском...");
    try {
        const tempPath = DATA_FILE + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(usersData, null, 2), 'utf8');
        fs.renameSync(tempPath, DATA_FILE);
        logger.debug(`💾 БД: Файл успешно обновлен. Объектов сохранено: ${Object.keys(usersData).length}`);
    } catch (e) {
        logger.error(`💾 БД ERROR: Не удалось сохранить данные: ${e.message}`);
    }
}

// --- [3. АВТОРИЗАЦИЯ] ---
function validateInitData(initData, uid) {
    if (!initData) {
        logger.warn(`⚠️ AUTH: initData отсутствует для пользователя ${uid}`);
        return false;
    }
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        const dataCheckString = Array.from(urlParams.entries())
            .map(([key, value]) => `${key}=${value}`).sort().join('\n');
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(API_TOKEN).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        
        const isValid = hmac === hash;
        logger.debug(`🔍 AUTH: Проверка hash для ${uid}: ${isValid ? 'SUCCESS' : 'FAILED'}`);
        return isValid;
    } catch (e) {
        logger.error(`🔍 AUTH ERROR: Сбой валидации для ${uid}: ${e.message}`);
        return false;
    }
}

// --- [4. API И РОУТЫ] ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'static')));

// Логирование каждого входящего HTTP запроса (кроме статики)
app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && req.path !== WEBHOOK_PATH) return next();
    logger.debug(`📡 HTTP: ${req.method} ${req.path} | IP: ${req.ip}`);
    next();
});

app.use(bot.webhookCallback(WEBHOOK_PATH));

const getBaseProfile = (uid) => ({
    id: uid, balance: 0, click_lvl: 1, pnl: 0,
    energy: 1000, max_energy: 1000, last_active: Math.floor(Date.now() / 1000)
});

app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    logger.debug(`📡 API: Запрос баланса для ID: ${uid}`);
    if (!usersData[uid]) {
        logger.info(`📡 API: Новый пользователь ${uid}, создаем профиль.`);
        usersData[uid] = getBaseProfile(uid);
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    const auth = req.headers['authorization'];

    if (!validateInitData(auth, uid)) {
        logger.warn(`⚠️ API SAVE: Попытка сохранения без валидной авторизации! (ID: ${uid})`);
    }

    if (uid && uid !== 'undefined') {
        if (!usersData[uid]) usersData[uid] = getBaseProfile(uid);
        
        const oldBalance = usersData[uid].balance;
        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        usersData[uid].last_active = Math.floor(Date.now() / 1000);
        
        logger.debug(`📡 API SAVE: Профиль ${uid} обновлен. Баланс: ${oldBalance} -> ${usersData[uid].balance}`);
        res.json({ status: "ok" });
    } else {
        logger.error(`📡 API SAVE ERROR: Получен некорректный ID: ${uid}`);
        res.status(400).json({ status: "error" });
    }
});

// --- [5. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}`;
    logger.info(`🎯 BOT: Получена команда /start от ${uid} (${ctx.from.username || 'no_user'})`);
    
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE AI</b>\n\nСистема инициализирована. Добро пожаловать, агент <code>${uid}</code>.`,
            Markup.inlineKeyboard([
                [Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", webAppUrl)],
                [Markup.button.url("КАНАЛ ПРОЕКТА", "https://t.me/neural_pulse_news")]
            ])
        );
        logger.debug(`🎯 BOT: Ответ на /start успешно отправлен пользователю ${uid}`);
    } catch (e) { 
        logger.error(`🎯 BOT ERROR: Не удалось ответить пользователю ${uid}: ${e.message}`); 
    }
});

// --- [6. ЗАПУСК] ---
loadData();
const saveInterval = setInterval(saveData, 60000);

app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`🌐 SERVER: Слушает порт ${PORT}`);
    try {
        const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
        logger.info(`🤖 BOT: Попытка установки вебхука на ${hookUrl}...`);
        await bot.telegram.setWebhook(hookUrl, { drop_pending_updates: true });
        logger.info(`🤖 BOT: Вебхук успешно подтвержден Telegram.`);
    } catch (err) {
        logger.error(`🤖 BOT ERROR: Фатальная ошибка вебхука: ${err.message}`);
    }
});

// Безопасный выход
const handleExit = (signal) => {
    logger.warn(`🛑 SYSTEM: Получен сигнал ${signal}. Начинаем процедуру выключения...`);
    clearInterval(saveInterval);
    saveData();
    logger.info("🛑 SYSTEM: Процесс завершен корректно.");
    process.exit(0);
};

process.on('SIGTERM', () => handleExit('SIGTERM'));
process.on('SIGINT', () => handleExit('SIGINT'));
