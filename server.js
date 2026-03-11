const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os'); 
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// ==========================================
// [1] ЯДРО ЛОГИРОВАНИЯ
// ==========================================
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss.SSS' }), 
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()} > ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

// ==========================================
// [2] ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ
// ==========================================
const API_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const ADMIN_ID = 476014374; 
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse";

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const BACKUP_FILE = path.join(DATA_DIR, 'users.bak');

const app = express();
app.set('trust proxy', 1);
const bot = new Telegraf(API_TOKEN);

// ==========================================
// [3] ДВИЖОК БАЗЫ ДАННЫХ
// ==========================================
let usersData = {};

function initDatabase() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            fs.copyFileSync(DATA_FILE, BACKUP_FILE);
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
        }
        return Object.keys(usersData).length;
    } catch (e) {
        logger.error(`🚨 [DB CRASH] ${e.message}`);
        return 0;
    }
}

function saveData() {
    try {
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(usersData, null, 2));
        fs.renameSync(tmp, DATA_FILE); 
    } catch (e) { logger.error(`💾 [SYNC ERROR] ${e.message}`); }
}

// ==========================================
// [4] СЕТЕВОЙ СЛОЙ (ИСПРАВЛЕННЫЙ)
// ==========================================
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

// ГЛОБАЛЬНЫЙ РАДАР
app.use((req, res, next) => {
    if (req.url !== '/health') {
        logger.debug(`[СЕТЬ] Запрос: ${req.method} ${req.originalUrl}`);
    }
    next();
});

// МОНИТОРИНГ
app.get('/health', (req, res) => {
    res.json({ status: 'ONLINE', users: Object.keys(usersData).length });
});

// 🛡️ БРОНЕБОЙНЫЙ ВЕБХУК (С защитой от слэшей)
const handleTgUpdate = async (req, res) => {
    if (!req.body || !req.body.update_id) {
        return res.status(400).send('No payload');
    }
    try {
        await bot.handleUpdate(req.body, res);
    } catch (e) {
        logger.error(`❌ [TG ERROR] ${e.message}`);
        if (!res.headersSent) res.sendStatus(500);
    }
};

app.post(WEBHOOK_PATH, handleTgUpdate);
app.post(`${WEBHOOK_PATH}/`, handleTgUpdate); // Защита от лишнего слэша

// Ловушка для 404 (Диагностика)
app.use((req, res) => {
    logger.warn(`⚠️  404 NOT FOUND: ${req.method} ${req.originalUrl} - Проверь настройки вебхука!`);
    res.status(404).send('Not Found');
});

// ==========================================
// [5] ИНТЕРФЕЙС БОТА
// ==========================================
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : "Агент";
    
    try {
        const msg = await ctx.replyWithHTML(
            `🖥 <b>NEURAL TERMINAL v3.0</b>\n<code>> Establishing link...</code>\n<code>[▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒] 10%</code>`
        );
        await delay(500);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
            `🖥 <b>NEURAL TERMINAL v3.0</b>\n<code>> Decrypting sector... OK</code>\n<code>[██████████▒▒▒▒▒] 75%</code>`,
            { parse_mode: 'HTML' }
        ).catch(() => {});
        await delay(500);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
            `🦾 <b>ACCESS GRANTED</b>\n👤 АГЕНТ: <code>${username}</code>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", `${WEB_APP_URL}/?u=${uid}`)]
                ])
            }
        ).catch(() => {});
    } catch (e) { logger.error(`❌ [UI ERROR]: ${e.message}`); }
});

// ==========================================
// [6] API ДЛЯ WEBAPP
// ==========================================
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, last_seen: Date.now() };
        saveData(); 
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    if (uid && usersData[uid]) {
        usersData[uid].balance = Number(score);
        usersData[uid].energy = Number(energy);
        usersData[uid].last_seen = Date.now();
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// ==========================================
// [7] ЗАПУСК СИСТЕМЫ
// ==========================================
let server;

async function bootSystem() {
    initDatabase();
    try {
        await bot.telegram.getMe();
        server = app.listen(PORT, '0.0.0.0', async () => {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            logger.info(`✅ [SYSTEM ONLINE] Порт: ${PORT} | Вебхук: ${hookUrl}`);
        });
    } catch (e) {
        logger.error(`🛑 [FATAL] ${e.message}`);
        process.exit(1);
    }
}

const syncInterval = setInterval(saveData, 60000);

function shutdown(signal) {
    clearInterval(syncInterval);
    saveData();
    if (server) server.close(() => process.exit(0));
    else process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

bootSystem();
