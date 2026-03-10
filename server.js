const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
// Используем переменную окружения. Если её нет - ставим твой токен (но лучше через панель Bothost)
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
        logger.error(`📂 БД error: ${e.message}`);
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2), 'utf8');
        logger.debug("💾 БД: Сохранено");
    } catch (e) {
        logger.error(`💾 БД error: ${e.message}`);
    }
}

// --- [3. ВАЛИДАЦИЯ ТЕЛЕГРАМ] ---
function validateInitData(initData) {
    if (!initData) return false;
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        const dataCheckString = Array.from(urlParams.entries())
            .map(([key, value]) => `${key}=${value}`).sort().join('\n');
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(API_TOKEN).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        return hmac === hash;
    } catch (e) { return false; }
}

// --- [4. MIDDLEWARE & ROUTES] ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// ВАЖНО: Правильное подключение вебхука Telegraf
app.use(bot.webhookCallback(WEBHOOK_PATH));

const getBaseProfile = (uid) => ({
    id: uid, balance: 0, click_lvl: 1, pnl: 0, 
    energy: 1000, max_energy: 1000, last_active: Math.floor(Date.now() / 1000)
});

// API Эндпоинты
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) usersData[uid] = getBaseProfile(uid);
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    const authHeader = req.headers['authorization'];

    // Проверка (логируем, но не блокируем пока)
    if (!validateInitData(authHeader)) logger.warn(`⚠️ AUTH FAIL: ${uid}`);

    if (uid && uid !== 'undefined') {
        if (!usersData[uid]) usersData[uid] = getBaseProfile(uid);
        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        usersData[uid].last_active = Math.floor(Date.now() / 1000);
        res.json({ status: "ok" });
    } else {
        res.status(400).json({ status: "error" });
    }
});

// --- [5. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}`;
    
    logger.info(`🎯 BOT: Старт от ${uid}`);
    
    await ctx.replyWithHTML(
        `<b>🦾 NEURAL PULSE AI</b>\n\nСистема инициализирована. Добро пожаловать, агент <code>${uid}</code>.\n\nНачни добычу нейро-токенов прямо сейчас!`,
        Markup.inlineKeyboard([
            [Markup.button.webApp("ЗАПУСТИТЬ 🧠", webAppUrl)],
            [Markup.button.url("КАНАЛ ПРОЕКТА", "https://t.me/neural_pulse_news")]
        ])
    );
});

// --- [6. ЗАПУСК] ---
async function startServer() {
    loadData();
    
    app.listen(PORT, async () => {
        logger.info(`🌐 SERVER: Порт ${PORT}`);
        try {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            await bot.telegram.setWebhook(hookUrl, {
                drop_pending_updates: true // Очистит очередь зависших сообщений
            });
            logger.info(`🤖 BOT: Вебхук установлен на ${hookUrl}`);
        } catch (err) {
            logger.error(`🤖 BOT ERROR: ${err.message}`);
        }
    });
}

// Автосохранение раз в минуту
setInterval(saveData, 60000);

startServer();
