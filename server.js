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
            // Проверка на пустой файл или некорректный JSON
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
        // Атомарная запись через временный файл
        const tmpFile = DATA_FILE + '.tmp';
        const content = JSON.stringify(usersData, null, 2);
        fs.writeFileSync(tmpFile, content, 'utf8');
        fs.renameSync(tmpFile, DATA_FILE);
        logger.debug("💾 БД: Данные синхронизированы успешно");
    } catch (e) {
        logger.error("❌ БД SAVE ERROR: " + e.message);
    }
}

// --- [3. MIDDLEWARE & WEBHOOK] ---
app.use(cors());
app.use(express.json()); // Переместил вверх для всех роутов
app.use(express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
    res.status(200).send('Neural Pulse Core is Live');
});

// Обработка вебхука Telegram
app.post(WEBHOOK_PATH, async (req, res) => {
    try {
        if (req.body && req.body.update_id) {
            await bot.handleUpdate(req.body, res);
        } else {
            res.sendStatus(200);
        }
    } catch (e) {
        logger.error(`❌ ВЕБХУК ERROR: ${e.message}`);
        if (!res.headersSent) res.sendStatus(500);
    }
});

// --- [4. API] ---
const getInitialProfile = (uid) => ({
    id: uid,
    balance: 100,
    click_lvl: 1,
    pnl: 10,
    energy: 1000,
    max_energy: 1000,
    last_active: Math.floor(Date.now() / 1000)
});

app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = getInitialProfile(uid);
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    try {
        const { user_id, score, energy } = req.body;
        const uid = String(user_id);
        
        if (!uid || uid === 'undefined') {
            return res.status(400).json({ status: "error", message: "Invalid user_id" });
        }

        // Если пользователя нет в памяти, создаем его
        if (!usersData[uid]) {
            usersData[uid] = getInitialProfile(uid);
        }

        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        usersData[uid].last_active = Math.floor(Date.now() / 1000);
        
        res.json({ status: "ok" });
    } catch (e) {
        logger.error(`❌ API SAVE ERROR: ${e.message}`);
        res.status(500).json({ status: "error" });
    }
});

// Интервал сохранения — раз в минуту
setInterval(saveData, 60000);

// --- [5. БОТ] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    // v=timestamp помогает сбросить кэш WebApp в приложении Telegram
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
    
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE</b>\n\nПротокол активирован. Добро пожаловать, агент.`, 
            Markup.inlineKeyboard([
                [Markup.button.webApp("ВХОД 🧠", webAppUrl)]
            ])
        );
        logger.info(`✅ БОТ: /start нажат пользователем ${uid}`);
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
        logger.info(`🌐 СЕРВЕР: Запущен на порту ${PORT}`);
        try {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            // Очищаем хвосты и ставим новый вебхук
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            
            const info = await bot.telegram.getWebhookInfo();
            logger.info(`🤖 БОТ: Вебхук успешно установлен: ${info.url}`);
            
            if (process.send) process.send('ready'); 
        } catch (err) {
            logger.error(`🤖 WEBHOOK SET ERROR: ${err.message}`);
        }
    });
}

// Корректное завершение (Graceful Shutdown)
const shutdown = () => {
    logger.warn("⚠️ Получен сигнал завершения. Сохранение данных...");
    saveData();
    // Даем 500мс на завершение операций записи перед выходом
    setTimeout(() => {
        process.exit(0);
    }, 500);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
