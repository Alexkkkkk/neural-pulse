const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

// --- [CONFIG] ---
const API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM";
const WEB_APP_URL = "https://np.bothost.ru"; 

const app = express();
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

// Настройки безопасности и статики
app.use(cors());
app.use(express.json({ limit: '50kb' })); // Увеличил лимит

// Исправлено: если index.html лежит в /static, то корень должен смотреть туда
app.use(express.static(path.join(__dirname, 'static')));

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

// --- [DATABASE] ---
async function initDB() {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        db = await open({
            filename: path.join(dataDir, 'game.db'),
            driver: sqlite3.Database
        });
        
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
                level INTEGER DEFAULT 1,
                last_active INTEGER
            );
        `);
        logger.success("Neural Core Database: ONLINE");
    } catch (err) {
        logger.error("Database initialization failed", err);
        process.exit(1);
    }
}

// --- [API] ---

// Главная точка входа (отдает index.html из статики)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    if (!uid || uid === "undefined" || uid === "null") return res.status(400).send("ID_REQUIRED");

    if (userCache.has(uid)) {
        return res.json({ status: "ok", data: userCache.get(uid), cache: true });
    }

    try {
        let userData = await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const now = Math.floor(Date.now() / 1000);

        if (!userData) {
            userData = {
                id: uid, balance: 1000.0, click_lvl: 1, pnl: 0.0,
                energy: 1000.0, max_energy: 1000, level: 1, last_active: now
            };
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                          [uid, 1000, 1, 0, 1000, 1000, 1, now]);
        }
        
        // Приведение типов
        userData.balance = parseFloat(userData.balance);
        userData.pnl = parseFloat(userData.pnl);
        userData.energy = parseFloat(userData.energy);
        
        userCache.set(uid, userData);
        res.json({ status: "ok", data: userData });
    } catch (e) {
        logger.error(`API Balance Error: ${uid}`, e.message);
        res.status(500).json({ error: "Core Sync Failure" });
    }
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy, tap_power, pnl } = req.body;
    const uid = String(user_id);
    if (!user_id || user_id === "guest" || user_id === "undefined") return res.json({status: "ignored"});

    const now = Math.floor(Date.now() / 1000);
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

// Апгрейд клика
app.post('/api/upgrade/click', async (req, res) => {
    const uid = String(req.body.user_id);
    let user = userCache.get(uid);
    
    if (!user) return res.status(404).json({ status: "error", message: "User not found" });

    const cost = Math.floor(500 * Math.pow(1.5, user.click_lvl - 1));

    if (user.balance >= cost) {
        user.balance -= cost;
        user.click_lvl += 1;
        userCache.set(uid, user);
        saveQueue.add(uid);
        res.json({ status: "ok", newBalance: user.balance, newLvl: user.click_lvl });
    } else {
        res.status(400).json({ status: "error", message: "Low balance" });
    }
});

// Добавлен эндпоинт для пассивного дохода (Mine)
app.post('/api/upgrade/mine', async (req, res) => {
    const uid = String(req.body.user_id);
    let user = userCache.get(uid);
    if (!user) return res.status(404).json({ status: "error" });

    const cost = Math.floor(1000 * Math.pow(1.7, (user.pnl / 100))); 
    if (user.balance >= cost) {
        user.balance -= cost;
        user.pnl += 100; 
        userCache.set(uid, user);
        saveQueue.add(uid);
        res.json({ status: "ok", newBalance: user.balance, newPnl: user.pnl });
    } else {
        res.status(400).json({ status: "error", message: "Low balance" });
    }
});

// --- [SYNC] ---
async function flushToDisk() {
    if (saveQueue.size === 0) return;
    const toSaveIds = Array.from(saveQueue);
    saveQueue.clear();

    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`UPDATE users SET balance=?, energy=?, click_lvl=?, pnl=?, last_active=? WHERE id=?`);
        for (const uid of toSaveIds) {
            const d = userCache.get(uid);
            if (d) await stmt.run(d.balance, d.energy, d.click_lvl, d.pnl, d.last_active, uid);
        }
        await stmt.finalize();
        await db.run('COMMIT');
        logger.info(`💾 Sync: ${toSaveIds.length} agents updated.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("Disk Write Failure", e);
    }
}
setInterval(flushToDisk, 10000);

// --- [BOT] ---
bot.start((ctx) => {
    // Убираем v=Date.now, если оно ломает кэширование на бэкенде, 
    // но оставляем u=ID для инициализации
    const url = `${WEB_APP_URL}/?u=${ctx.from.id}`;
    ctx.replyWithHTML(
        `🦾 <b>NEURAL PULSE SYSTEM</b>\n\nСистема онлайн. Терминал готов.`,
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", url)]])
    );
});

// --- [START] ---
const PORT = process.env.PORT || 3000;
async function start() {
    await initDB();
    server.listen(PORT, '0.0.0.0', () => logger.success(`CORE ONLINE: PORT ${PORT}`));
    bot.launch();
}

start();
