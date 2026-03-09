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
const SECRET_PATH = `/telegraf/7659a15effe06d8b7c88477cbafce593ca20cefc052d061b5beafae78d9a1cde`;

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

const app = express();
app.set('trust proxy', 1); // Обязательно для Bothost
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

// --- [2. ОБРАБОТКА ВЕБХУКА (БЕЗ ПАРСЕРОВ)] ---
app.use(cors());

// Логирование входящих запросов
app.post('*', (req, res, next) => {
    if (req.url === SECRET_PATH) {
        logger.debug(`📥 Webhook: Получен POST от Telegram`);
    }
    next();
});

// ВАЖНО: Ставим вебхук ПЕРЕД express.json()
app.use(bot.webhookCallback(SECRET_PATH));

// Парсеры только для твоих API
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [3. ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    const dataDir = path.join(__dirname, 'data'); 
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    
    try {
        db = await open({ 
            filename: path.join(dataDir, 'game.db'), 
            driver: sqlite3.Database 
        });
        
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
        logger.error("❌ БД: ОШИБКА: " + err.message); 
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
            const earnings = (pnl / 3600) * Math.min(secondsOffline, 10800);
            user.balance = (parseFloat(user.balance) || 0) + earnings;
        }
        user.energy = Math.min(parseInt(user.max_energy) || 1000, (parseFloat(user.energy) || 0) + (secondsOffline * 3));
        user.last_active = now;
        return true;
    }
    return false;
}

// --- [5. API] ---
app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    try {
        let user = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        if (!user) {
            user = { id: uid, balance: 100.0, click_lvl: 1, pnl: 10.0, energy: 1000.0, max_energy: 1000, last_active: Math.floor(Date.now() / 1000) };
            await db.run(`INSERT INTO users (id, balance, pnl, last_active, energy, max_energy, click_lvl) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [uid, user.balance, user.pnl, user.last_active, user.energy, user.max_energy, user.click_lvl]);
        } else {
            processOffline(user);
        }
        userCache.set(uid, user);
        res.json({ status: "ok", data: user });
    } catch (e) { res.status(500).json({ status: "error", message: e.message }); }
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const user = userCache.get(String(user_id));
    if (user) {
        user.balance = parseFloat(score);
        user.energy = parseFloat(energy);
        user.last_active = Math.floor(Date.now() / 1000);
        saveQueue.add(String(user_id));
        res.json({ status: "ok" });
    } else { res.status(404).json({ status: "error" }); }
});

// --- [6. СИНХРОНИЗАЦИЯ] ---
async function flushToDisk() {
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
        logger.debug(`💾 ДИСК: Синхронизировано ${ids.length} игроков`);
    } catch (e) { if (db) await db.run('ROLLBACK'); logger.error("🛑 ДИСК: " + e.message); }
}
setInterval(flushToDisk, 20000);

// --- [7. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    logger.info(`✅ БОТ: Получена команда /start от ${uid}`);
    const webAppUrlWithParams = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
    
    await ctx.replyWithHTML(
        `🦾 <b>NEURAL PULSE</b>\n\nПротокол PnL активирован. Твои шахты работают, пока ты спишь.\n\n<i>Твой ID: ${uid}</i>`, 
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrlWithParams)]])
    ).catch(err => logger.error(`❌ Ошибка ответа: ${err.message}`));
});

// --- [8. ЗАПУСК] ---
async function start() {
    await initDB();
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 СЕРВЕР: LIVE на порту ${PORT}`);
        try {
            await bot.telegram.setWebhook(`${WEB_APP_URL}${SECRET_PATH}`, { drop_pending_updates: true });
            logger.info(`🤖 БОТ: Webhook установлен`);
        } catch (err) { logger.error(`🤖 БОТ: Ошибка вебхука: ${err.message}`); }
    });
}

const shutdown = async () => {
    logger.info("🚀 ЗАВЕРШЕНИЕ...");
    await flushToDisk();
    if (db) await db.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
