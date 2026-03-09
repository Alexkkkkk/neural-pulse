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
// Используем переменную окружения или твой токен (лучше скрыть в панели Bothost)
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAFnDpiHM7siB9h8XzARhlfzHurzCGQ9sAM";
const WEB_APP_URL = "https://np.bothost.ru"; 

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }),
        new winston.transports.File({ filename: './logs/combined.log' })
    ]
});

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

// Лимиты для защиты от спама
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5000, 
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

// --- [2. БЕЗОПАСНОСТЬ (Хэширование)] ---
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
    } catch (e) { return false; }
}

const validateUser = (req, res, next) => {
    const initData = req.headers['x-tg-data'];
    if (!initData || !verifyTelegramWebAppData(initData)) {
        return res.status(403).json({ error: "Access Denied: Invalid Signature" });
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
        logger.error("DB Critical Error: " + err.message);
        process.exit(1);
    }
}

// --- [5. API] ---

app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    try {
        let userData = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const now = Math.floor(Date.now() / 1000);

        if (!userData) {
            userData = { id: uid, balance: 100, click_lvl: 1, pnl: 0, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, last_active) VALUES (?, 100, ?)`, [uid, now]);
            logger.info(`New User Created: ${uid}`);
        } else {
            // Оффлайн доход
            const offlineTime = Math.max(0, now - userData.last_active);
            if (offlineTime > 0 && userData.pnl > 0) {
                userData.balance += (userData.pnl / 3600) * offlineTime;
                userData.energy = Math.min(userData.max_energy, userData.energy + (offlineTime * 1.5));
                userData.last_active = now;
            }
        }
        
        userCache.set(uid, userData);
        res.json({ status: "ok", data: { ...userData, league: getLeague(userData.balance) } });
    } catch (e) {
        res.status(500).json({ error: "Sync Error" });
    }
});

app.post('/api/save', validateUser, async (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    try {
        let current = userCache.get(uid);
        if (current) {
            current.balance = Math.max(current.balance, Number(score));
            current.energy = Number(energy);
            current.last_active = Math.floor(Date.now() / 1000);
            userCache.set(uid, current);
            saveQueue.add(uid);
        }
        res.json({ status: "pulse_received" });
    } catch (e) { res.status(500).json({ error: "Save Error" }); }
});

// --- [6. ПЕРИОДИЧЕСКОЕ СОХРАНЕНИЕ] ---
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
        logger.info(`💾 Database: Synced ${ids.length} agents.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("Sync Error: " + e.message);
    }
}
setInterval(flushToDisk, 30000);

// --- [7. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const refId = ctx.startPayload;
    
    try {
        const existing = await db.get('SELECT id FROM users WHERE id = ?', [uid]);
        if (!existing) {
            let startBalance = 100;
            if (refId && refId !== uid) {
                startBalance = 5000; // Бонус новичку
                await db.run('UPDATE users SET balance = balance + 10000 WHERE id = ?', [refId]).catch(()=>{});
                logger.info(`Referral: ${refId} invited ${uid}`);
            }
            await db.run('INSERT INTO users (id, balance, referrer_id, last_active) VALUES (?, ?, ?, ?)', 
                [uid, startBalance, refId || null, Math.floor(Date.now()/1000)]);
        }

        ctx.replyWithHTML(`🦾 <b>NEURAL PULSE SYSTEM</b>\n\nАгент <b>${ctx.from.first_name}</b>, нейросеть готова к работе.`, 
            Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", `${WEB_APP_URL}/?u=${uid}`)]]));
    } catch (e) { logger.error("Bot Start Error: " + e.message); }
});

// --- [8. ЗАПУСК] ---
async function start() {
    await initDB();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => logger.info(`🌐 CORE LIVE: Running on port ${PORT}`));
    
    bot.launch({ dropPendingUpdates: true })
       .then(() => logger.info("🤖 Bot: Interface Online"));

    // Безопасное завершение для Docker/Bothost
    const shutdown = async (signal) => {
        logger.info(`Shutdown via ${signal}...`);
        await flushToDisk();
        if (db) await db.close();
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
