const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM";
const WEB_APP_URL = "https://np.bothost.ru"; 
const ADMIN_ID = "636603814"; 

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        })
    ]
});

const app = express();

// --- ВАЖНО: ФИКС ДЛЯ BOTHOST PROXY ---
app.set('trust proxy', 1); 

const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

// Лимитер (убирает ValidationError и правильно видит IP за прокси)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000, 
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }, 
    keyGenerator: (req) => req.ip, 
    message: { error: "Neural link unstable. Too many requests." }
});

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use('/api/', limiter);
app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [2. БЕЗОПАСНОСТЬ] ---
function verifyTelegramWebAppData(telegramInitData) {
    if (!telegramInitData) return false;
    try {
        const urlParams = new URLSearchParams(telegramInitData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        urlParams.sort();
        let dataCheckString = "";
        for (const [key, value] of urlParams.entries()) {
            dataCheckString += `${key}=${value}\n`;
        }
        dataCheckString = dataCheckString.slice(0, -1);
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(API_TOKEN).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        return hmac === hash;
    } catch (e) { return false; }
}

const validateUser = (req, res, next) => {
    const initData = req.headers['x-tg-data'];
    if (!initData || !verifyTelegramWebAppData(initData)) {
        logger.warn(`Unauthorized IP: ${req.ip}`);
        return res.status(403).json({ error: "Invalid Data Signature" });
    }
    next();
};

// --- [3. ЛОГИКА ЛИГ] ---
function getLeague(balance) {
    if (balance >= 1000000) return "DIAMOND CORE";
    if (balance >= 500000) return "PLATINUM PULSE";
    if (balance >= 100000) return "GOLDEN LINK";
    if (balance >= 25000) return "SILVER NEURAL";
    return "BRONZE LEAGUE";
}

// --- [4. БАЗА ДАННЫХ] ---
async function initDB() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    
    db = await open({ filename: path.join(dataDir, 'game.db'), driver: sqlite3.Database });
    await db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, balance REAL DEFAULT 0, click_lvl INTEGER DEFAULT 1,
            pnl REAL DEFAULT 0, energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000,
            last_active INTEGER, referrer_id TEXT
        );
    `);
    logger.info("Neural Core DB: ONLINE");
}

// --- [5. API] ---
app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    try {
        if (!db) return res.status(503).json({ error: "DB starting..." });
        
        let userData = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        if (!userData) {
            const now = Math.floor(Date.now() / 1000);
            userData = { id: uid, balance: 100, click_lvl: 1, pnl: 0, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, last_active) VALUES (?, 100, ?)`, [uid, now]);
        }
        
        const now = Math.floor(Date.now() / 1000);
        const offlineTime = Math.max(0, now - userData.last_active);
        if (offlineTime > 0) {
            userData.balance += (userData.pnl / 3600) * offlineTime;
            userData.energy = Math.min(userData.max_energy, userData.energy + (offlineTime * 1.5));
            userData.last_active = now;
        }
        
        userCache.set(uid, userData);
        res.json({ status: "ok", data: { ...userData, league: getLeague(userData.balance) } });
    } catch (e) {
        logger.error(`Balance Error: ${e.message}`);
        res.status(500).json({ error: "Sync Error" });
    }
});

app.post('/api/save', validateUser, async (req, res) => {
    const { user_id, score, energy, click_lvl, pnl } = req.body;
    const uid = String(user_id);
    
    try {
        if (!db) return res.status(503).json({ error: "DB connection lost" });
        
        let current = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]) || {};
        const updateData = {
            ...current,
            id: uid,
            balance: score !== undefined ? Number(score) : (current.balance || 0),
            energy: energy !== undefined ? Number(energy) : (current.energy || 1000),
            click_lvl: click_lvl !== undefined ? Number(click_lvl) : (current.click_lvl || 1),
            pnl: pnl !== undefined ? Number(pnl) : (current.pnl || 0),
            last_active: Math.floor(Date.now() / 1000)
        };
        
        userCache.set(uid, updateData);
        saveQueue.add(uid);
        res.json({ status: "pulse_received", league: getLeague(updateData.balance) });
    } catch (e) {
        res.status(500).json({ error: "Save process failed" });
    }
});

// --- [6. СИНХРОНИЗАЦИЯ] ---
async function flushToDisk() {
    if (saveQueue.size === 0 || !db) return;
    const ids = Array.from(saveQueue);
    saveQueue.clear();
    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`UPDATE users SET balance=?, energy=?, click_lvl=?, pnl=?, last_active=? WHERE id=?`);
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) await stmt.run(d.balance, d.energy, d.click_lvl, d.pnl, d.last_active, id);
        }
        await stmt.finalize();
        await db.run('COMMIT');
        logger.info(`💾 Synced ${ids.length} agents.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("Sync Error: " + e.message);
    }
}
setInterval(flushToDisk, 20000);

// --- [7. БОТ] ---
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const refId = ctx.startPayload;
    try {
        if (!db) return ctx.reply("Система загружается, подождите секунду...");
        const existing = await db.get('SELECT id FROM users WHERE id = ?', [uid]);
        if (!existing) {
            const now = Math.floor(Date.now()/1000);
            let startBalance = 100;
            if (refId && refId !== uid) {
                startBalance = 5000;
                await db.run('UPDATE users SET balance = balance + 10000 WHERE id = ?', [refId]);
            }
            await db.run('INSERT INTO users (id, balance, referrer_id, last_active) VALUES (?, ?, ?, ?)', [uid, startBalance, refId || null, now]);
        }
    } catch (e) { logger.error("Bot Error: " + e.message); }

    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE SYSTEM</b>`, Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", `${WEB_APP_URL}/?u=${uid}`)]]));
});

// --- [8. ЗАПУСК] ---
async function start() {
    await initDB();
    const PORT = process.env.PORT || 3000;
    
    // Запуск сервера
    server.listen(PORT, '0.0.0.0', () => logger.info(`CORE ONLINE: PORT ${PORT}`));
    
    // Запуск бота
    bot.launch({ dropPendingUpdates: true })
        .then(() => logger.info("Telegram Bot: OK"))
        .catch(err => logger.error("Bot fail: " + err.message));

    const shutdown = async () => {
        logger.info("Shutdown signal... Saving everything!");
        await flushToDisk();
        process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

start().catch(e => logger.error("Fatal Crash: " + e.message));
