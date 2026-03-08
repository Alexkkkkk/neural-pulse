const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

// --- [ULTRA CONFIG] ---
const API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM";
const WEB_APP_URL = "https://np.bothost.ru"; 

const app = express();
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

app.use(cors());
app.use(express.json({ limit: '10kb' })); // Защита от огромных JSON
app.use('/static', express.static(path.join(__dirname, 'static')));

const logger = {
    info: (msg) => console.log(`[${new Date().toLocaleTimeString()}] 🟦 INFO: ${msg}`),
    success: (msg) => console.log(`[${new Date().toLocaleTimeString()}] 🟩 SUCCESS: ${msg}`),
    warn: (msg) => console.log(`[${new Date().toLocaleTimeString()}] 🟧 WARN: ${msg}`),
    error: (msg, err = '') => console.log(`[${new Date().toLocaleTimeString()}] 🟥 FATAL: ${msg}`, err),
    api: (method, url, uid) => console.log(`[${new Date().toLocaleTimeString()}] 🌐 ${method} ${url} | ID: ${uid}`)
};

let db;
const userCache = new Map(); 
const saveQueue = new Set(); 

// --- [DATABASE: ENTERPRISE LAYER] ---
async function initDB() {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        db = await open({
            filename: path.join(dataDir, 'game.db'),
            driver: sqlite3.Database
        });
        
        // Настройки для максимального FPS базы данных
        await db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA temp_store = MEMORY;
            PRAGMA cache_size = -64000; 
            PRAGMA busy_timeout = 10000;
            PRAGMA mmap_size = 268435456;

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                balance REAL DEFAULT 0,
                click_lvl INTEGER DEFAULT 1,
                pnl REAL DEFAULT 0,
                energy REAL DEFAULT 1000,
                max_energy INTEGER DEFAULT 1000,
                level INTEGER DEFAULT 1,
                last_active INTEGER
            );
        `);
        logger.success("Neural Core Database: ONLINE (High-Performance Mode)");
    } catch (err) {
        logger.error("Database initialization failed", err);
        process.exit(1);
    }
}

// --- [API: HIGH-SPEED LAYER] ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'static', 'index.html')));

app.get('/api/balance/:userId', async (req, res) => {
    const uid = req.params.userId;
    if (!uid || uid === "undefined") return res.status(400).send("ID_REQUIRED");

    // Hot Path: возврат из RAM
    if (userCache.has(uid)) {
        return res.json({ status: "ok", data: userCache.get(uid), cache: true });
    }

    try {
        const userData = await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const now = Math.floor(Date.now() / 1000);

        if (userData) {
            userCache.set(uid, userData);
            res.json({ status: "ok", data: userData });
        } else {
            const newUser = {
                id: uid, balance: 1000.0, click_lvl: 1, pnl: 0.0,
                energy: 1000.0, max_energy: 1000, level: 1, last_active: now
            };
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                          Object.values(newUser));
            userCache.set(uid, newUser);
            logger.info(`New agent authorized: ${uid}`);
            res.json({ status: "ok", data: newUser });
        }
    } catch (e) {
        logger.error(`API Balance Error: ${uid}`, e.message);
        res.status(500).json({ error: "Core Sync Failure" });
    }
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy, tap_power, pnl } = req.body;
    const uid = String(user_id);
    
    if (!user_id || user_id === "guest") return res.json({status: "ignored"});

    const cachedUser = userCache.get(uid);
    const now = Math.floor(Date.now() / 1000);

    // Логика защиты: не сохраняем, если данные в кэше новее, чем пришедшие
    if (cachedUser && cachedUser.last_active > now) return res.json({status: "stale_ignored"});

    const updateData = {
        id: uid,
        balance: parseFloat(score) || 0,
        energy: parseFloat(energy) || 0,
        click_lvl: parseInt(tap_power) || 1,
        pnl: parseFloat(pnl) || 0,
        last_active: now
    };

    userCache.set(uid, updateData);
    saveQueue.add(uid);
    res.json({ status: "pulse_received" });
});

app.post('/api/upgrade/click', async (req, res) => {
    const uid = String(req.body.user_id);
    const user = userCache.get(uid);
    
    if (!user) return res.status(404).json({ status: "error", message: "User not in cache" });

    const cost = Math.floor(500 * Math.pow(1.5, user.click_lvl - 1));

    if (user.balance >= cost) {
        user.click_lvl += 1;
        user.balance -= cost;
        userCache.set(uid, user);
        saveQueue.add(uid); 
        logger.success(`Agent ${uid} upgraded CLICK to LVL ${user.click_lvl}`);
        res.json({ status: "ok", newBalance: user.balance, newLvl: user.click_lvl });
    } else {
        res.status(400).json({ status: "error", message: "Insufficient balance" });
    }
});

// --- [ULTRA-FAST BATCH SAVER] ---
async function flushToDisk() {
    if (saveQueue.size === 0) return;

    const start = Date.now();
    const toSaveIds = Array.from(saveQueue);
    saveQueue.clear();

    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`
            UPDATE users SET balance = ?, energy = ?, click_lvl = ?, pnl = ?, last_active = ? WHERE id = ?
        `);

        for (const uid of toSaveIds) {
            const d = userCache.get(uid);
            if (d) await stmt.run(d.balance, d.energy, d.click_lvl, d.pnl, d.last_active, uid);
        }

        await stmt.finalize();
        await db.run('COMMIT');
        logger.info(`💾 Batch Save: ${toSaveIds.length} agents synced in ${Date.now() - start}ms`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("Disk Write Failure", e);
        toSaveIds.forEach(id => saveQueue.add(id));
    }
}
setInterval(flushToDisk, 10000); // Синхронизация каждые 10 секунд

// --- [BOT PROTOCOL] ---
bot.start((ctx) => {
    const url = `${WEB_APP_URL}/?u=${ctx.from.id}&v=${Date.now()}`;
    ctx.replyWithHTML(
        `🦾 <b>NEURAL PULSE SYSTEM</b>\n\nДобро пожаловать в сеть. Твой терминал готов к работе.`,
        Markup.inlineKeyboard([[Markup.button.webApp("ИНИЦИИРОВАТЬ ВХОД 🧠", url)]])
    );
});

// --- [LIFECYCLE & SAFETY] ---
const PORT = process.env.PORT || 3000;

async function start() {
    await initDB();
    server.listen(PORT, '0.0.0.0', () => logger.success(`CORE ONLINE: PORT ${PORT}`));
    
    bot.launch().catch(err => logger.error("Bot launch failed", err));

    const shutdown = async (signal) => {
        logger.warn(`Shutdown signal [${signal}] received.`);
        await flushToDisk();
        if (db) await db.close();
        process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    
    // Защита от "падений" сервера
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
}

start();
