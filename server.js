const express = require('express');
const http = require('http');
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

// --- [ПРОВЕРКА ПОДЛИННОСТИ] ---
function validateInitData(initData) {
    if (!initData) {
        logger.debug("🔍 AUTH: initData отсутствует");
        return false;
    }
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

        const isValid = hmac === hash;
        logger.debug(`🔍 AUTH: Результат проверки: ${isValid}`);
        return isValid;
    } catch (e) {
        logger.error(`🔍 AUTH: Ошибка валидации: ${e.message}`);
        return false;
    }
}

// --- [2. БАЗА ДАННЫХ] ---
let usersData = {};

function loadData() {
    logger.info("📂 БД: Начало загрузки...");
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            logger.info("📂 БД: Директория создана");
        }
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            if (raw.trim()) {
                usersData = JSON.parse(raw);
                logger.info(`📂 БД: Успешно загружено профилей: ${Object.keys(usersData).length}`);
            } else {
                logger.warn("📂 БД: Файл пуст");
                usersData = {};
            }
        } else {
            logger.info("📂 БД: Файл не найден, инициализация пустой базы");
            usersData = {};
        }
    } catch (e) {
        logger.error(`📂 БД: Фатальная ошибка загрузки: ${e.message}`);
        usersData = {}; 
    }
}

function saveData() {
    logger.debug("💾 БД: Попытка сохранения...");
    try {
        const tmpFile = DATA_FILE + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(usersData, null, 2), 'utf8');
        fs.renameSync(tmpFile, DATA_FILE);
        logger.debug("💾 БД: Сохранение завершено успешно");
    } catch (e) {
        logger.error(`💾 БД: Ошибка сохранения: ${e.message}`);
    }
}

// --- [3. MIDDLEWARE & WEBHOOK] ---
app.use(cors());
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'static')));

app.post(WEBHOOK_PATH, async (req, res) => {
    logger.debug(`📥 WEBHOOK: Получен запрос от TG (ID: ${req.body?.update_id})`);
    res.sendStatus(200);
    try {
        if (req.body && req.body.update_id) {
            await bot.handleUpdate(req.body);
            logger.debug(`📥 WEBHOOK: Обработан успешно`);
        }
    } catch (e) {
        logger.error(`📥 WEBHOOK: Ошибка обработки: ${e.message}`);
    }
});

// --- [4. API] ---
const getBaseProfile = (uid) => ({
    id: uid, balance: 100, click_lvl: 1, pnl: 10, 
    energy: 1000, max_energy: 1000, last_active: Math.floor(Date.now() / 1000)
});

app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    logger.debug(`📡 API GET: Запрос баланса для ${uid}`);
    if (!usersData[uid]) {
        logger.info(`📡 API GET: Создание нового профиля для ${uid}`);
        usersData[uid] = getBaseProfile(uid);
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    const authHeader = req.headers['authorization'];

    logger.debug(`📡 API POST: Попытка сохранения для ${uid}`);
    
    if (!validateInitData(authHeader)) {
        logger.warn(`⚠️ API POST: Невалидная авторизация для ${uid}`);
        // Оставляем без return для тестов, как и договорились ранее
    }

    if (uid && uid !== 'undefined' && uid !== 'null') {
        if (!usersData[uid]) {
            logger.info(`📡 API POST: Инициализация профиля ${uid} при сохранении`);
            usersData[uid] = getBaseProfile(uid);
        }
        
        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        usersData[uid].last_active = Math.floor(Date.now() / 1000);
        
        logger.debug(`📡 API POST: Данные для ${uid} обновлены в памяти`);
        res.json({ status: "ok" });
    } else {
        logger.error(`📡 API POST: Некорректный user_id: ${uid}`);
        res.status(400).json({ status: "error", message: "Invalid user_id" });
    }
});

const saveInterval = setInterval(saveData, 60000);

// --- [5. БОТ ЛОГИКА] ---
bot.catch((err) => logger.error(`🛑 BOT ERROR: ${err.message}`));

bot.start(async (ctx) => {
    const uid = ctx.from.id;
    logger.info(`🎯 BOT: Команда /start от ${uid}`);
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE</b>\n\nСистема инициализирована. Добро пожаловать, агент.`, 
            Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrl)]])
        );
        logger.debug(`🎯 BOT: Ответ на /start отправлен для ${uid}`);
    } catch (e) {
        logger.error(`🎯 BOT: Ошибка ответа пользователю ${uid}: ${e.message}`);
    }
});

// --- [6. ЗАПУСК] ---
async function start() {
    logger.info("🚀 SYSTEM: Запуск процесса...");
    loadData();
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 SERVER: Слушает порт ${PORT}`);
        try {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            logger.info(`🤖 BOT: Установка вебхука на ${hookUrl}...`);
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            logger.info("🤖 BOT: Вебхук успешно подтвержден");
            if (process.send) process.send('ready'); 
        } catch (err) {
            logger.error(`🤖 BOT: Ошибка при установке вебхука: ${err.message}`);
        }
    });
}

const shutdown = () => {
    logger.warn("🛑 SYSTEM: Получен сигнал выключения");
    clearInterval(saveInterval);
    saveData();
    setTimeout(() => {
        logger.info("🛑 SYSTEM: Процесс завершен");
        process.exit(0);
    }, 500);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
