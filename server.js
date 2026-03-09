const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAGb0-TC4z3uFK2glOUJeU_wHnr27474zzQ";
const WEB_APP_URL = "https://np.bothost.ru"; 
const PORT = process.env.PORT || 3000;
// Изменили на "/", чтобы прокси хостинга гарантированно доставлял пакеты
const SECRET_PATH = "/"; 

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

logger.info("🛠 СИСТЕМА: Запуск процесса...");

const app = express();
app.set('trust proxy', 1); 
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

// --- [2. MIDDLEWARE & WEBHOOK] ---
app.use(cors());

// ВАЖНО: Вебхук на корневом пути "/" ПЕРЕД express.json()
app.post('/', (req, res) => {
    logger.debug(`📥 WEBHOOK: Входящий POST запрос от Telegram на "/"`);
    bot.webhookCallback('/')(req, res);
});

// Парсеры для API и статика
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Логгер для API запросов (теперь не конфликтует с ботом)
app.use((req, res, next) => {
    if (req.method !== 'POST' || req.url !== '/') {
        logger.debug(`🔍 ТРАФИК: ${req.method} на ${req.url}`);
    }
    next();
});

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [3. БАЗА ДАННЫХ] ---
async function initDB() {
    logger.info("📦 БД: Подключение...");
    const dataDir = path.join(__dirname, 'data'); 
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.warn("📁 БД: Создана папка /data");
    }
    
    try {
        db = await open({ filename: path.join(dataDir, 'game.db'), driver: sqlite3.Database });
        await db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, balance REAL DEFAULT 0, click_lvl INTEGER DEFAULT 1,
                pnl REAL DEFAULT 0, energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, last_active INTEGER
            );
        `);
        logger.info("🚀 БД: СТАТУС - ONLINE");
    } catch (err) { 
        logger.error("❌ БД CRITICAL: " + err.message); 
        process.exit(1); 
    }
}

// --- [4. ЛОГИКА ДОХОДА] ---
function processOffline(user) {
    const now = Math.floor(Date.now() / 1000);
    const lastActive = parseInt(user.last_active) || now;
    const secondsOffline = now - lastActive;
    
    if (secondsOffline > 5) {
        const pnl = parseFloat(user.pnl) || 0;
        if (pnl > 0) {
            const effectiveTime = Math.min(secondsOffline, 10800);
            const earnings = (pnl / 3600) * effectiveTime;
            user.balance = (parseFloat(user.balance) || 0) + earnings;
            logger.debug(`💰 INCOME: Игрок ${user.id} +${earnings.toFixed(2)} за ${effectiveTime}с`);
        }
        const regen = secondsOffline * 3;
        user.energy = Math.min(parseInt(user.max_energy) || 1000, (parseFloat(user.energy) || 0) + regen);
        user.last_active = now;
        return true;
    }
    return false;
}

// --- [5. API] ---
app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    try {
        let user = userCache.get(uid);
        if (!user) {
            user = await db.get('SELECT * FROM users WHERE id = ?', [uid]);
            if (!user) {
                const now = Math.floor(Date.now() / 1000);
                user = { id: uid, balance: 100, click_lvl: 1, pnl: 10, energy: 1000, max_energy: 1000, last_active: now };
                await db.run(`INSERT INTO users (id, balance, pnl, last_active, energy, max_energy, click_lvl) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                    [uid, user.balance, user.pnl, user.last_active, user.energy, user.max_energy, user.click_lvl]);
                logger.info(`🆕 API: Создан игрок ${uid}`);
            }
        }
        processOffline(user);
        userCache.set(uid, user);
        res.json({ status: "ok", data: user });
    } catch (e) { 
        logger.error(`❌ API GET ERROR: ${e.message}`);
        res.status(500).json({ status: "error" }); 
    }
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    const user = userCache.get(uid);
    if (user) {
        user.balance = parseFloat(score);
        user.energy = parseFloat(energy);
        user.last_active = Math.floor(Date.now() / 1000);
        saveQueue.add(uid);
        res.json({ status: "ok" });
    } else {
        res.status(404).json({ status: "error", message: "User not in cache" });
    }
});

// --- [6. СИНХРОНИЗАЦИЯ] ---
async function flush() {
    if (saveQueue.size === 0) return;
    const ids = Array.from(saveQueue); 
    saveQueue.clear();
    try {
        await db.run('BEGIN TRANSACTION');
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) await db.run(`UPDATE users SET balance=?, click_lvl=?, pnl=?, energy=?, last_active=? WHERE id=?`, 
                [d.balance, d.click_lvl, d.pnl, d.energy, d.last_active, id]);
        }
        await db.run('COMMIT');
        logger.info(`💾 SYNC: Сохранено ${ids.length} профилей`);
    } catch (e) { 
        if (db) await db.run('ROLLBACK'); 
        logger.error(`🛑 SYNC ERROR: ${e.message}`);
    }
}
setInterval(flush, 20000);

// --- [7. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    logger.info(`🤖 BOT: /start от ${ctx.from.id}`);
    try {
        const uid = ctx.from.id;
        const webAppUrl = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
        
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE</b>\n\nПротокол активирован. Твой ID: <code>${uid}</code>`, 
            Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrl)]])
        );
    } catch (e) { logger.error(`❌ BOT START ERROR: ${e.message}`); }
});

// --- [8. ЗАПУСК] ---
async function start() {
    await initDB();
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 СЕРВЕР: LIVE на порту ${PORT}`);
        try {
            // Устанавливаем вебхук прямо на основной домен
            await bot.telegram.setWebhook(`${WEB_APP_URL}`, {
                drop_pending_updates: true,
                allowed_updates: ['message', 'callback_query']
            });
            const info = await bot.telegram.getWebhookInfo();
            logger.info(`🤖 БОТ: Вебхук установлен на корень -> ${info.url}`);
        } catch (err) { 
            logger.error(`🤖 БОТ WEBHOOK ERROR: ${err.message}`); 
        }
    });
}

const shutdown = async () => {
    logger.warn("🚀 ЗАВЕРШЕНИЕ РАБОТЫ...");
    await flush();
    if (db) await db.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
