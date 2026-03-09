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

// --- [1. КОНФИГУРАЦИЯ И УЛУЧШЕННОЕ ЛОГИРОВАНИЕ] ---
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAFnDpiHM7siB9h8XzARhlfzHurzCGQ9sAM";
const WEB_APP_URL = "https://np.bothost.ru"; 

const logger = winston.createLogger({
    level: 'debug', // Включаем режим отладки для Pro
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.Console({ 
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()) 
        }),
        new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: './logs/combined.log' })
    ]
});

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000, // Увеличили лимит для Pro тарифа
    keyGenerator: (req) => req.ip,
    message: { error: "Neural link unstable. Too many requests." }
});

app.use(cors());
app.use(express.json({ limit: '20kb' }));
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
        let dataCheckString = Array.from(urlParams.entries()).map(([k, v]) => `${k}=${v}`).join('\n');
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(API_TOKEN).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        return hmac === hash;
    } catch (e) { 
        logger.error(`Security Check Failed: ${e.message}`);
        return false; 
    }
}

const validateUser = (req, res, next) => {
    const initData = req.headers['x-tg-data'];
    if (!initData || !verifyTelegramWebAppData(initData)) {
        logger.warn(`Unauthorized API access attempt from IP: ${req.ip}`);
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
    
    try {
        db = await open({ filename: path.join(dataDir, 'game.db'), driver: sqlite3.Database });
        await db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA temp_store = MEMORY;
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, 
                balance REAL DEFAULT 0, 
                click_lvl INTEGER DEFAULT 1,
                pnl REAL DEFAULT 0, 
                energy REAL DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,
                last_active INTEGER, 
                referrer_id TEXT
            );
        `);
        logger.info("🚀 Neural Core DB: ONLINE (WAL Mode Active)");
    } catch (err) {
        logger.error("❌ DB Init Critical Fail: " + err.message);
        process.exit(1);
    }
}

// --- [5. API С ПОЛНЫМ ЛОГИРОВАНИЕМ] ---

app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    try {
        if (!db) throw new Error("Database not ready");
        
        let userData = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const now = Math.floor(Date.now() / 1000);

        if (!userData) {
            logger.info(`🆕 Registering new agent: ${uid}`);
            userData = { id: uid, balance: 100, click_lvl: 1, pnl: 0, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, last_active) VALUES (?, 100, ?)`, [uid, now]);
        } else {
            const offlineTime = Math.max(0, now - userData.last_active);
            if (offlineTime > 0 && userData.pnl > 0) {
                const mined = (userData.pnl / 3600) * offlineTime;
                userData.balance += mined;
                userData.energy = Math.min(userData.max_energy, userData.energy + (offlineTime * 1.5));
                userData.last_active = now;
                logger.debug(`💰 Agent ${uid} mined ${mined.toFixed(2)} while offline`);
            }
        }
        
        userCache.set(uid, userData);
        res.json({ status: "ok", data: { ...userData, league: getLeague(userData.balance) } });
    } catch (e) {
        logger.error(`Balance Sync Error [ID: ${uid}]: ${e.message}`);
        res.status(500).json({ error: "Sync Error" });
    }
});

app.post('/api/save', validateUser, async (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    
    try {
        let current = userCache.get(uid);
        if (!current) return res.status(404).json({ error: "Cache miss" });

        current.balance = Math.max(current.balance, Number(score));
        current.energy = Number(energy);
        current.last_active = Math.floor(Date.now() / 1000);
        
        userCache.set(uid, current);
        saveQueue.add(uid);
        
        logger.debug(`📥 Pulse saved for agent ${uid}. Balance: ${current.balance}`);
        res.json({ status: "pulse_received" });
    } catch (e) {
        logger.error(`Save Fail [ID: ${uid}]: ${e.message}`);
        res.status(500).json({ error: "Internal Error" });
    }
});

// --- [6. СИНХРОНИЗАЦИЯ] ---
async function flushToDisk() {
    if (saveQueue.size === 0) return;
    const ids = Array.from(saveQueue);
    saveQueue.clear();
    
    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`UPDATE users SET balance=?, energy=?, last_active=? WHERE id=?`);
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) await stmt.run(d.balance, d.energy, d.last_active, id);
        }
        await stmt.finalize();
        await db.run('COMMIT');
        logger.info(`💾 Database: Successfully synced ${ids.length} agents.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("🛑 Critical Disk Write Error: " + e.message);
        ids.forEach(id => saveQueue.add(id));
    }
}
setInterval(flushToDisk, 30000);

// --- [7. БОТ И ЗАПУСК] ---
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    logger.info(`🤖 Bot Start Command from: ${uid}`);
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE SYSTEM</b>\n\nАгент <b>${ctx.from.first_name}</b>, система активна.`, 
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД В НЕЙРОСЕТЬ 🧠", `${WEB_APP_URL}/?u=${uid}`)]]));
});

async function start() {
    await initDB();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`🌐 CORE LIVE: Running on port ${PORT}`);
        logger.info(`📊 Memory Limit: ${process.env.NODE_OPTIONS || 'Default'}`);
    });
    
    bot.launch({ dropPendingUpdates: true })
        .then(() => logger.info("🤖 Bot Interface: Connection Established"))
        .catch(err => logger.error("Bot launch fail: " + err.message));

    // Правильное завершение для Docker
    const shutdown = async (signal) => {
        logger.info(`Received ${signal}. Graceful shutdown...`);
        clearInterval(flushToDisk);
        await flushToDisk();
        if (db) await db.close();
        process.exit(0);
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
