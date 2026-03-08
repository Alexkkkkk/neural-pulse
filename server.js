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

// --- [1. КОНФИГУРАЦИЯ И ЛОГИРОВАНИЕ] ---
const API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM";
const WEB_APP_URL = "https://np.bothost.ru"; 

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        })
    ]
});

const app = express();
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

// Защита от спама: макс 100 запросов за 15 минут с одного IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests" }
});

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use('/api/', limiter);
app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [2. БЕЗОПАСНОСТЬ: ПРОВЕРКА ДАННЫХ TELEGRAM] ---
function verifyTelegramWebAppData(telegramInitData) {
    if (!telegramInitData) return false;
    try {
        const encoded = decodeURIComponent(telegramInitData);
        const secret = crypto.createHmac('sha256', 'WebAppData').update(API_TOKEN).digest();
        const arr = encoded.split('&').filter(x => !x.startsWith('hash=')).sort();
        const dataCheckString = arr.join('\n');
        const hashPart = encoded.split('&').find(x => x.startsWith('hash='));
        if (!hashPart) return false;
        const _hash = hashPart.split('=')[1];
        const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
        return hmac === _hash;
    } catch (e) {
        return false;
    }
}

// Middleware для проверки подписи во всех POST запросах
const validateUser = (req, res, next) => {
    const initData = req.headers['x-tg-data'];
    if (!initData || !verifyTelegramWebAppData(initData)) {
        logger.warn(`Unauthorized attempt: IP ${req.ip}`);
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
    if (!fs.existsSync('logs')) fs.mkdirSync('logs');

    db = await open({ filename: path.join(dataDir, 'game.db'), driver: sqlite3.Database });
    await db.exec(`
        PRAGMA journal_mode = WAL;
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
        let userData = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        
        if (!userData) {
            const now = Math.floor(Date.now() / 1000);
            userData = { id: uid, balance: 100, click_lvl: 1, pnl: 0, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, last_active) VALUES (?, 100, ?)`, [uid, now]);
        }

        const now = Math.floor(Date.now() / 1000);
        const offlineTime = Math.max(0, now - userData.last_active);
        
        // Оффлайн расчеты
        userData.balance += (userData.pnl / 3600) * offlineTime;
        userData.energy = Math.min(userData.max_energy, userData.energy + (offlineTime * 1.5));
        userData.last_active = now;

        userCache.set(uid, userData);
        res.json({ status: "ok", data: { ...userData, league: getLeague(userData.balance) } });
    } catch (e) {
        logger.error(`Balance API Error [${uid}]: ${e.message}`);
        res.status(500).json({ error: "Sync Error" });
    }
});

app.post('/api/save', validateUser, (req, res) => {
    const { user_id, score, energy, click_lvl, pnl } = req.body;
    const uid = String(user_id);
    const current = userCache.get(uid) || {};

    const updateData = {
        ...current,
        id: uid,
        balance: score !== undefined ? parseFloat(score) : current.balance,
        energy: energy !== undefined ? parseFloat(energy) : current.energy,
        click_lvl: click_lvl !== undefined ? parseInt(click_lvl) : current.click_lvl,
        pnl: pnl !== undefined ? parseFloat(pnl) : current.pnl,
        last_active: Math.floor(Date.now() / 1000)
    };

    userCache.set(uid, updateData);
    saveQueue.add(uid);
    res.json({ status: "pulse_received", league: getLeague(updateData.balance) });
});

app.post('/api/upgrade/click', validateUser, async (req, res) => {
    const uid = String(req.body.user_id);
    let user = userCache.get(uid);
    if (!user) return res.status(404).json({ error: "Not found" });

    const cost = Math.floor(500 * Math.pow(1.6, user.click_lvl - 1));
    if (user.balance >= cost) {
        user.balance -= cost;
        user.click_lvl += 1;
        userCache.set(uid, user);
        saveQueue.add(uid);
        res.json({ status: "ok", balance: user.balance, lvl: user.click_lvl });
    } else res.status(400).json({ error: "Low balance" });
});

app.post('/api/upgrade/mine', validateUser, async (req, res) => {
    const uid = String(req.body.user_id);
    let user = userCache.get(uid);
    if (!user) return res.status(404).json({ error: "Not found" });

    const cost = Math.floor(1000 * Math.pow(1.5, (user.pnl / 100)));
    if (user.balance >= cost) {
        user.balance -= cost;
        user.pnl += 100;
        userCache.set(uid, user);
        saveQueue.add(uid);
        res.json({ status: "ok", balance: user.balance, pnl: user.pnl });
    } else res.status(400).json({ error: "Low balance" });
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const top = await db.all(`SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10`);
        res.json({ status: "ok", leaderboard: top.map((p, i) => ({ 
            rank: i+1, id: p.id, balance: Math.floor(p.balance), league: getLeague(p.balance) 
        })) });
    } catch (e) { res.status(500).json({ error: "Leaderboard fail" }); }
});

// --- [6. СИНХРОНИЗАЦИЯ С ДИСКОМ] ---
async function flushToDisk() {
    if (saveQueue.size === 0) return;
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

// --- [7. БОТ И РЕФЕРАЛЫ] ---
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const refId = ctx.startPayload; // ID пригласившего из ссылки

    const existing = await db.get('SELECT id FROM users WHERE id = ?', [uid]);
    if (!existing && refId && refId !== uid) {
        await db.run('INSERT OR IGNORE INTO users (id, balance, referrer_id, last_active) VALUES (?, 5000, ?, ?)', 
            [uid, refId, Math.floor(Date.now()/1000)]);
        await db.run('UPDATE users SET balance = balance + 10000 WHERE id = ?', [refId]);
        ctx.reply("🎁 Бонус 5,000 токенов за вход по ссылке!");
        bot.telegram.sendMessage(refId, "🦾 Ваш реферал в сети! +10,000 токенов.");
    }

    ctx.replyWithHTML(
        `🦾 <b>NEURAL PULSE SYSTEM</b>\n\nСистема онлайн. Терминал готов.`,
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД В НЕЙРОСЕТЬ 🧠", `${WEB_APP_URL}/?u=${uid}`)]])
    );
});

// --- [8. ЗАПУСК] ---
async function start() {
    await initDB();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => logger.info(`CORE ONLINE: PORT ${PORT}`));
    bot.launch().catch(e => logger.error("Bot fail: " + e.message));

    process.on('SIGINT', async () => {
        await flushToDisk();
        process.exit();
    });
}
start();
