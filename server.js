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

app.use(cors());
app.use(express.json({ limit: '50kb' }));
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

// Вспомогательная функция для определения лиги по балансу
function getLeague(balance) {
    if (balance >= 1000000) return "DIAMOND CORE";
    if (balance >= 500000) return "PLATINUM PULSE";
    if (balance >= 100000) return "GOLDEN LINK";
    if (balance >= 25000) return "SILVER NEURAL";
    return "BRONZE LEAGUE";
}

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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// Получение баланса и расчет оффлайн-дохода
app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    if (!uid || uid === "undefined" || uid === "null") return res.status(400).send("ID_REQUIRED");

    try {
        let userData = userCache.get(uid);
        
        if (!userData) {
            userData = await db.get('SELECT * FROM users WHERE id = ?', [uid]);
            if (!userData) {
                const now = Math.floor(Date.now() / 1000);
                userData = {
                    id: uid, balance: 0.0, click_lvl: 1, pnl: 0.0,
                    energy: 1000.0, max_energy: 1000, level: 1, last_active: now
                };
                await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                              [uid, 0.0, 1, 0.0, 1000.0, 1000, 1, now]);
            }
        }

        const now = Math.floor(Date.now() / 1000);
        const offlineTime = now - userData.last_active;
        
        // Начисляем пассивный доход (PNL) за время отсутствия (если есть)
        if (offlineTime > 0 && userData.pnl > 0) {
            const earned = (userData.pnl / 3600) * offlineTime;
            userData.balance += earned;
        }

        // Регенерация энергии (1.5 ед/сек)
        if (offlineTime > 0 && userData.energy < userData.max_energy) {
            userData.energy = Math.min(userData.max_energy, userData.energy + (offlineTime * 1.5));
        }

        userData.last_active = now;
        userCache.set(uid, userData);
        
        res.json({ 
            status: "ok", 
            data: { ...userData, league: getLeague(userData.balance) } 
        });
    } catch (e) {
        logger.error(`API Balance Error: ${uid}`, e.message);
        res.status(500).json({ error: "Core Sync Failure" });
    }
});

// Сохранение состояния
app.post('/api/save', (req, res) => {
    const { user_id, score, energy, click_lvl, pnl } = req.body;
    const uid = String(user_id);
    if (!user_id || user_id === "guest" || user_id === "undefined") return res.json({status: "ignored"});

    const current = userCache.get(uid) || {};
    const updateData = {
        id: uid,
        balance: parseFloat(score) ?? current.balance,
        energy: parseFloat(energy) ?? current.energy,
        click_lvl: parseInt(click_lvl) ?? current.click_lvl,
        pnl: parseFloat(pnl) ?? current.pnl,
        last_active: Math.floor(Date.now() / 1000),
        max_energy: current.max_energy || 1000,
        level: current.level || 1
    };

    userCache.set(uid, updateData);
    saveQueue.add(uid);
    res.json({ status: "pulse_received", league: getLeague(updateData.balance) });
});

// Таблица лидеров
app.get('/api/leaderboard', async (req, res) => {
    try {
        await flushToDisk(); // Сбрасываем кэш, чтобы топ был честным
        const top = await db.all(`SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10`);
        const result = top.map((p, i) => ({
            rank: i + 1,
            id: p.id,
            balance: Math.floor(p.balance),
            league: getLeague(p.balance)
        }));
        res.json({ status: "ok", leaderboard: result });
    } catch (e) {
        res.status(500).json({ error: "Leaderboard fail" });
    }
});

// Улучшение клика
app.post('/api/upgrade/click', async (req, res) => {
    const uid = String(req.body.user_id);
    let user = userCache.get(uid);
    if (!user) return res.status(404).json({ status: "error" });

    const cost = Math.floor(500 * Math.pow(1.6, user.click_lvl - 1));
    if (user.balance >= cost) {
        user.balance -= cost;
        user.click_lvl += 1;
        userCache.set(uid, user);
        saveQueue.add(uid);
        res.json({ status: "ok", balance: user.balance, lvl: user.click_lvl });
    } else {
        res.status(400).json({ status: "error", message: "Low balance" });
    }
});

// Улучшение пассивного дохода
app.post('/api/upgrade/mine', async (req, res) => {
    const uid = String(req.body.user_id);
    let user = userCache.get(uid);
    if (!user) return res.status(404).json({ status: "error" });

    const cost = Math.floor(1000 * Math.pow(1.5, (user.pnl / 100))); 
    if (user.balance >= cost) {
        user.balance -= cost;
        user.pnl += 100; 
        userCache.set(uid, user);
        saveQueue.add(uid);
        res.json({ status: "ok", balance: user.balance, pnl: user.pnl });
    } else {
        res.status(400).json({ status: "error", message: "Low balance" });
    }
});

// --- [SYNC SYSTEM] ---
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
        logger.info(`💾 Database Synced: ${ids.length} users.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("Sync Error", e);
    }
}
setInterval(flushToDisk, 15000); // Сохраняем каждые 15 секунд

// --- [BOT] ---
bot.start((ctx) => {
    const url = `${WEB_APP_URL}/?u=${ctx.from.id}`;
    ctx.replyWithHTML(
        `🦾 <b>NEURAL PULSE SYSTEM</b>\n\nСистема онлайн. Терминал готов.\n\n<b>ID:</b> <code>${ctx.from.id}</code>`,
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД В НЕЙРОСЕТЬ 🧠", url)]])
    );
});

// --- [START] ---
const PORT = process.env.PORT || 3000;
async function start() {
    await initDB();
    server.listen(PORT, '0.0.0.0', () => logger.success(`CORE ONLINE: PORT ${PORT}`));
    
    process.on('SIGINT', async () => {
        await flushToDisk();
        process.exit();
    });

    bot.launch();
}

start();
