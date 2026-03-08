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

// --- [ИНИЦИАЛИЗАЦИЯ БД + ТАБЛИЦЫ] ---
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
        logger.success("База данных подключена и таблицы проверены");
    } catch (err) {
        logger.error("Ошибка инициализации БД", err);
    }
}

// --- [API] ---

// Загрузка баланса
app.get('/api/balance/:userId', async (req, res) => {
    const uid = req.params.userId;
    logger.api('GET', '/balance', uid);
    
    try {
        let userData = await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const now = Math.floor(Date.now() / 1000);

        if (userData) {
            res.json({ status: "ok", data: userData });
        } else {
            logger.warn(`Новый пользователь! Регистрирую ${uid}...`);
            // Исправлены ключи: balance вместо score, click_lvl вместо tap_power
            const newUser = {
                id: uid,
                balance: 1000,
                click_lvl: 1,
                pnl: 0,
                energy: 1000,
                max_energy: 1000,
                level: 1,
                last_active: now
            };
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                          [newUser.id, newUser.balance, newUser.click_lvl, newUser.pnl, newUser.energy, newUser.max_energy, newUser.level, newUser.last_active]);
            
            res.json({ status: "ok", data: newUser });
        }
    } catch (e) { 
        logger.error(`Ошибка запроса баланса для ${uid}`, e.message);
        res.status(500).json({ error: "DB Error" }); 
    }
});

// Сохранение
app.post('/api/save', (req, res) => {
    const { user_id, score, energy, tap_power, pnl } = req.body;
    if (!user_id || user_id === "guest") return res.json({status: "ignored"});
    
    saveQueue.set(String(user_id), {
        balance: parseFloat(score),
        energy: parseFloat(energy),
        click_lvl: parseInt(tap_power),
        pnl: parseFloat(pnl),
        last_active: Math.floor(Date.now() / 1000)
    });
    res.json({ status: "queued" }); 
});

// Апгрейд клика
app.post('/api/upgrade/click', async (req, res) => {
    const { user_id } = req.body;
    logger.api('POST', '/upgrade/click', user_id);
    
    try {
        const user = await db.get('SELECT balance, click_lvl FROM users WHERE id = ?', [String(user_id)]);
        if (!user) return res.json({ status: "error", message: "User not found" });

        const cost = Math.floor(500 * Math.pow(1.5, user.click_lvl - 1));

        if (user.balance >= cost) {
            const newLvl = user.click_lvl + 1;
            const newBal = user.balance - cost;
            await db.run('UPDATE users SET balance = ?, click_lvl = ? WHERE id = ?', [newBal, newLvl, String(user_id)]);
            logger.success(`User ${user_id} купил CLICK LVL ${newLvl}`);
            res.json({ status: "ok", newBalance: newBal, newLvl });
        } else {
            res.json({ status: "error", message: "Недостаточно средств для апгрейда" });
        }
    } catch (e) { 
        logger.error("Upgrade click error", e); 
        res.status(500).json({ status: "error", message: "Internal server error" }); 
    }
});

// --- [ОЧЕРЕДЬ СОХРАНЕНИЯ В БД] ---
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
        logger.info(`💾 Пакетное сохранение: ${count} юзеров синхронизировано`);
    } catch (e) {
        await db.run('ROLLBACK');
        logger.error("Ошибка сброса очереди в БД", e);
    }
}
setInterval(flushQueue, 15000);

// --- [ТЕЛЕГРАМ БОТ] ---
bot.start((ctx) => {
    logger.info(`Бот запущен пользователем: ${ctx.from.id}`);
    const url = `${WEB_APP_URL}/?u=${ctx.from.id}&v=${Date.now()}`;
    ctx.replyWithHTML(`🦾 <b>Neural Pulse Active</b>\n\nДобро пожаловать в нейронную сеть. Начни майнить токены прямо сейчас!`, Markup.inlineKeyboard([
        [Markup.button.webApp("ВХОД 🧠", url)]
    ]));
});

// --- [ЗАПУСК] ---
const PORT = process.env.PORT || 3000;
async function start() {
    await initDB();
    server.listen(PORT, '0.0.0.0', () => {
        logger.success(`🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT}`);
    });
    bot.launch();
    logger.success("Бот успешно подключен к Telegram API");
}

start();
