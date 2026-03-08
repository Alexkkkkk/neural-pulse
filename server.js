const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

// --- [КОНФИГУРАЦИЯ] ---
const API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM";
const WEB_APP_URL = "https://np.bothost.ru"; 

const app = express();
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

app.use(cors());
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

let db;
const saveQueue = new Map();

const logger = {
    info: (msg, data = '') => console.log(`[${new Date().toISOString()}] 🟦 INFO: ${msg}`, data),
    success: (msg, data = '') => console.log(`[${new Date().toISOString()}] 🟩 SUCCESS: ${msg}`, data),
    warn: (msg, data = '') => console.warn(`[${new Date().toISOString()}] 🟧 WARN: ${msg}`, data),
    error: (msg, err = '') => console.error(`[${new Date().toISOString()}] 🟥 ERROR: ${msg}`, err),
    debug: (msg, data = '') => console.debug(`[${new Date().toISOString()}] 🟪 DEBUG: ${msg}`, data)
};

// --- [ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir); // Создаем папку, если её нет

        logger.info("Попытка инициализации базы данных...");
        db = await open({
            filename: path.join(dataDir, 'game.db'),
            driver: sqlite3.Database
        });
        
        await db.run('PRAGMA journal_mode = WAL');
        await db.run('PRAGMA synchronous = NORMAL');
        logger.success("База данных готова и оптимизирована");
    } catch (err) {
        logger.error("КРИТИЧЕСКАЯ ОШИБКА БД:", err);
    }
}

// --- [ЛОГИКА ПАКЕТНОГО СОХРАНЕНИЯ] ---
async function flushQueue() {
    if (!db) return;
    const count = saveQueue.size;
    if (count === 0) return;

    const users = Array.from(saveQueue.entries());
    saveQueue.clear();

    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`
            UPDATE users SET 
                balance = ?, click_lvl = ?, pnl = ?, 
                energy = ?, level = ?, last_active = ? 
            WHERE id = ?
        `);

        for (const [id, d] of users) {
            await stmt.run(d.balance, d.click_lvl, d.pnl, d.energy, d.level, d.last_active, id);
        }

        await stmt.finalize();
        await db.run('COMMIT');
        logger.debug(`Синхронизировано пользователей: ${count}`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("ОШИБКА СОХРАНЕНИЯ!", e.message);
        users.forEach(([id, d]) => { if(!saveQueue.has(id)) saveQueue.set(id, d); });
    }
}

setInterval(flushQueue, 15000);

// --- [API] ---

app.get('/api/balance/:userId', async (req, res) => {
    const userId = String(req.params.userId);
    try {
        let userData = saveQueue.get(userId) || await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        const now = Math.floor(Date.now() / 1000);

        if (userData) {
            const score = userData.balance || 0;
            const offTime = Math.min(now - (userData.last_active || now), 10800);
            const earned = (userData.pnl / 3600) * offTime;
            
            res.json({ status: "ok", data: {
                score: score + earned, 
                tap_power: userData.click_lvl || 1,
                pnl: userData.pnl || 0, 
                energy: userData.energy || 1000, 
                level: userData.level || 1,
                max_energy: userData.max_energy || 1000
            }});
        } else {
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, 1000, 1, 0, 1000, 1000, 1, ?)`, [userId, now]);
            res.json({ status: "ok", data: { score: 1000, tap_power: 1, pnl: 0, energy: 1000, max_energy: 1000, level: 1 }});
        }
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/save', (req, res) => {
    const d = req.body;
    if (!d.user_id || d.user_id === "guest") return res.json({status: "ignored"});
    saveQueue.set(String(d.user_id), {
        balance: parseFloat(d.score), click_lvl: parseInt(d.tap_power),
        pnl: parseFloat(d.pnl), energy: parseFloat(d.energy),
        level: parseInt(d.level), last_active: Math.floor(Date.now() / 1000)
    });
    res.json({ status: "queued" }); 
});

// Улучшение клика (BOOST)
app.post('/api/upgrade/click', async (req, res) => {
    const { user_id } = req.body;
    try {
        const user = await db.get('SELECT balance, click_lvl FROM users WHERE id = ?', [String(user_id)]);
        if (!user) return res.status(404).json({status: "error"});

        const cost = Math.floor(500 * Math.pow(1.5, user.click_lvl - 1));
        if (user.balance >= cost) {
            const newLvl = user.click_lvl + 1;
            const newBalance = user.balance - cost;
            await db.run('UPDATE users SET balance = ?, click_lvl = ? WHERE id = ?', [newBalance, newLvl, String(user_id)]);
            saveQueue.delete(String(user_id));
            res.json({ status: "ok", newBalance, newLvl });
        } else {
            res.json({ status: "error", message: "Недостаточно средств" });
        }
    } catch (e) { res.status(500).send(e.message); }
});

// Улучшение пассивного дохода (MINE)
app.post('/api/upgrade/mine', async (req, res) => {
    const { user_id } = req.body;
    try {
        const user = await db.get('SELECT balance, pnl FROM users WHERE id = ?', [String(user_id)]);
        const currentLvl = Math.floor(user.pnl / 150);
        const cost = Math.floor(1000 * Math.pow(1.6, currentLvl));

        if (user.balance >= cost) {
            const newPnl = user.pnl + 150;
            const newBalance = user.balance - cost;
            await db.run('UPDATE users SET balance = ?, pnl = ? WHERE id = ?', [newBalance, newPnl, String(user_id)]);
            saveQueue.delete(String(user_id));
            res.json({ status: "ok", newBalance, newPnl });
        } else {
            res.json({ status: "error", message: "Недостаточно средств" });
        }
    } catch (e) { res.status(500).send(e.message); }
});

bot.start((ctx) => {
    const url = `${WEB_APP_URL}/?u=${ctx.from.id}&v=${Math.random().toString(36).substring(7)}`;
    ctx.replyWithHTML(`🦾 <b>Neural Pulse Active</b>`, Markup.inlineKeyboard([
        [Markup.button.webApp("ВХОД 🧠", url)]
    ]));
});

const PORT = process.env.PORT || 3000;
async function start() {
    await initDB();
    server.listen(PORT, '0.0.0.0', () => logger.success(`🚀 СЕРВЕР НА ПОРТУ ${PORT}`));
    bot.launch();
}
start();
