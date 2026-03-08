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

// Красивый логгер
const logger = {
    info: (msg) => console.log(`[${new Date().toLocaleTimeString()}] 🟦 INFO: ${msg}`),
    success: (msg) => console.log(`[${new Date().toLocaleTimeString()}] 🟩 OK: ${msg}`),
    warn: (msg) => console.log(`[${new Date().toLocaleTimeString()}] 🟧 WARN: ${msg}`),
    error: (msg, err = '') => console.log(`[${new Date().toLocaleTimeString()}] 🟥 ERROR: ${msg}`, err),
    api: (method, url, uid) => console.log(`[${new Date().toLocaleTimeString()}] 🌐 ${method} ${url} | User: ${uid}`)
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

let db;
const saveQueue = new Map();

// --- [ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

        db = await open({
            filename: path.join(dataDir, 'game.db'),
            driver: sqlite3.Database
        });
        
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                balance REAL DEFAULT 0,
                click_lvl INTEGER DEFAULT 1,
                pnl REAL DEFAULT 0,
                energy REAL DEFAULT 1000,
                max_energy INTEGER DEFAULT 1000,
                level INTEGER DEFAULT 1,
                last_active INTEGER
            )
        `);

        await db.run('PRAGMA journal_mode = WAL');
        logger.success("База данных готова к работе (WAL mode)");
    } catch (err) {
        logger.error("Ошибка инициализации БД", err);
    }
}

// --- [API] ---

// Получение данных пользователя
app.get('/api/balance/:userId', async (req, res) => {
    const uid = req.params.userId;
    if (!uid || uid === "undefined") return res.status(400).json({ error: "Invalid ID" });
    
    logger.api('GET', '/balance', uid);
    
    try {
        let userData = await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const now = Math.floor(Date.now() / 1000);

        if (userData) {
            await db.run('UPDATE users SET last_active = ? WHERE id = ?', [now, uid]);
            res.json({ status: "ok", data: userData });
        } else {
            logger.warn(`Регистрация нового агента: ${uid}`);
            const newUser = {
                id: uid, 
                balance: 1000.0, 
                click_lvl: 1, 
                pnl: 0.0,
                energy: 1000.0, 
                max_energy: 1000, 
                level: 1, 
                last_active: now
            };
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                          [newUser.id, newUser.balance, newUser.click_lvl, newUser.pnl, 
                           newUser.energy, newUser.max_energy, newUser.level, newUser.last_active]);
            res.json({ status: "ok", data: newUser });
        }
    } catch (e) { 
        logger.error(`Ошибка запроса данных ${uid}`, e.message);
        res.status(500).json({ error: "System Error" }); 
    }
});

// Сохранение в очередь (для оптимизации записи)
app.post('/api/save', (req, res) => {
    const { user_id, score, energy, tap_power, pnl } = req.body;
    if (!user_id || user_id === "guest" || user_id === "undefined") return res.json({status: "ignored"});
    
    saveQueue.set(String(user_id), {
        balance: parseFloat(score) || 0,
        energy: parseFloat(energy) || 0,
        click_lvl: parseInt(tap_power) || 1,
        pnl: parseFloat(pnl) || 0,
        last_active: Math.floor(Date.now() / 1000)
    });
    res.json({ status: "queued" }); 
});

// Улучшение клика
app.post('/api/upgrade/click', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ status: "error" });
    
    logger.api('POST', '/upgrade/click', user_id);
    
    try {
        const user = await db.get('SELECT balance, click_lvl FROM users WHERE id = ?', [String(user_id)]);
        if (!user) return res.json({ status: "error", message: "User not found" });

        const cost = Math.floor(500 * Math.pow(1.5, user.click_lvl - 1));

        if (user.balance >= cost) {
            const newLvl = user.click_lvl + 1;
            const newBal = user.balance - cost;
            await db.run('UPDATE users SET balance = ?, click_lvl = ? WHERE id = ?', [newBal, newLvl, String(user_id)]);
            logger.success(`User ${user_id} купил апгрейд: LVL ${newLvl}`);
            res.json({ status: "ok", newBalance: newBal, newLvl });
        } else {
            res.json({ status: "error", message: "Недостаточно монет" });
        }
    } catch (e) { 
        logger.error("Ошибка апгрейда", e); 
        res.status(500).json({ status: "error" }); 
    }
});

// Функция сброса очереди в базу (раз в 15 сек)
async function flushQueue() {
    if (saveQueue.size === 0) return;
    const count = saveQueue.size;
    const users = Array.from(saveQueue.entries());
    saveQueue.clear();

    try {
        await db.run('BEGIN TRANSACTION');
        for (const [id, d] of users) {
            await db.run('UPDATE users SET balance = ?, energy = ?, click_lvl = ?, pnl = ?, last_active = ? WHERE id = ?', 
                        [d.balance, d.energy, d.click_lvl, d.pnl, d.last_active, id]);
        }
        await db.run('COMMIT');
        logger.info(`💾 Синхронизация данных: ${count} чел.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("Ошибка при пакетном сохранении", e);
    }
}
setInterval(flushQueue, 15000);

// --- [ТЕЛЕГРАМ БОТ] ---
bot.start((ctx) => {
    const url = `${WEB_APP_URL}/?u=${ctx.from.id}&v=${Date.now()}`;
    ctx.replyWithHTML(`🦾 <b>Neural Pulse Active</b>\n\nСистема готова к синхронизации.`, Markup.inlineKeyboard([
        [Markup.button.webApp("ВХОД 🧠", url)]
    ]));
});

// --- [ЗАПУСК И ЗАВЕРШЕНИЕ] ---
const PORT = process.env.PORT || 3000;

async function start() {
    await initDB();
    server.listen(PORT, '0.0.0.0', () => {
        logger.success(`СЕРВЕР ЗАПУЩЕН | ПОРТ: ${PORT}`);
    });
    
    bot.launch().catch(err => logger.error("Ошибка запуска бота", err));

    // Правильное завершение при перезагрузке хостинга
    process.once('SIGINT', () => {
        bot.stop('SIGINT');
        if (db) db.close();
        process.exit();
    });
    process.once('SIGTERM', () => {
        bot.stop('SIGTERM');
        if (db) db.close();
        process.exit();
    });
}

start();
