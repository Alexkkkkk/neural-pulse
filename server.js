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

// --- [1. КОНФИГУРАЦИЯ И ЛОГГЕР] ---
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAFnDpiHM7siB9h8XzARhlfzHurzCGQ9sAM";
const WEB_APP_URL = "https://np.bothost.ru"; 

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

logger.info("🛠 СИСТЕМА: Запуск процесса инициализации (Fix Syntax)...");

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

app.use(cors());
app.use(express.json({ limit: '15kb' }));

// Логируем каждый сетевой запрос
app.use((req, res, next) => {
    logger.debug(`📡 СЕТЬ: ${req.method} ${req.url} от ${req.ip}`);
    next();
});

app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [2. БЕЗОПАСНОСТЬ: ВЕРИФИКАЦИЯ] ---
function verifyTelegramWebAppData(telegramInitData) {
    logger.debug("🔐 БЕЗОПАСНОСТЬ: Проверка подписи...");
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
        logger.error(`❌ БЕЗОПАСНОСТЬ: Ошибка проверки: ${e.message}`);
        return false; 
    }
}

// --- [3. ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info("📁 ФАЙЛЫ: Создана директория /data");
    }
    try {
        db = await open({ filename: path.join(dataDir, 'game.db'), driver: sqlite3.Database });
        await db.exec(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, 
                balance REAL DEFAULT 0, 
                click_lvl INTEGER DEFAULT 1,
                pnl REAL DEFAULT 0, 
                energy REAL DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,
                last_active INTEGER
            );
        `);
        logger.info("🚀 БД: СТАТУС - ONLINE");
    } catch (err) { 
        logger.error("❌ БД: КРИТИЧЕСКАЯ ОШИБКА: " + err.message); 
    }
}

// --- [4. API ЭНДПОИНТЫ] ---

app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    logger.debug(`👤 ИГРОК: Запрос данных для UID ${uid}`);
    try {
        let userData = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        if (!userData) {
            const now = Math.floor(Date.now() / 1000);
            userData = { id: uid, balance: 100, click_lvl: 1, pnl: 0, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, last_active) VALUES (?, 100, ?)`, [uid, now]);
            logger.info(`🆕 ИГРОК: Зарегистрирован новый агент ${uid}`);
        }
        userCache.set(uid, userData);
        res.json({ status: "ok", data: userData });
    } catch (e) {
        logger.error(`❌ API: Ошибка баланса ${uid}: ${e.message}`);
        res.status(500).json({ status: "error" });
    }
});

app.post('/api/save', async (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    logger.debug(`📥 API: Сохранение прогресса UID ${uid}`);
    try {
        let current = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        if (current) {
            current.balance = Number(score);
            current.energy = Number(energy);
            current.last_active = Math.floor(Date.now() / 1000);
            userCache.set(uid, current);
            saveQueue.add(uid);
            res.json({ status: "ok" });
        } else {
            res.status(404).json({ status: "error", message: "User not found" });
        }
    } catch (e) { res.status(500).json({ status: "error" }); }
});

app.post('/api/upgrade/click', async (req, res) => {
    const { user_id } = req.body;
    const uid = String(user_id);
    logger.debug(`🛠 API: Запрос UPGRADE CLICK для ${uid}`);
    try {
        let user = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const cost = (user.click_lvl || 1) * 500;
        
        if (user.balance >= cost) {
            user.balance -= cost;
            user.click_lvl = (user.click_lvl || 1) + 1;
            userCache.set(uid, user);
            saveQueue.add(uid);
            logger.info(`✅ UPGRADE: UID ${uid} -> LVL ${user.click_lvl}`);
            res.json({ status: "ok", new_lvl: user.click_lvl, new_balance: user.balance });
        } else {
            logger.warn(`⚠️ UPGRADE: У игрока ${uid} недостаточно средств`);
            res.status(400).json({ status: "error", message: "Low balance" });
        }
    } catch (e) { res.status(500).json({ status: "error" }); }
});

// --- [5. СИНХРОНИЗАЦИЯ] ---
async function flushToDisk() {
    if (saveQueue.size === 0) {
        logger.debug("⏲ ТАЙМЕР: Очередь пуста.");
        return;
    }
    const ids = Array.from(saveQueue);
    saveQueue.clear();
    logger.info(`💾 ДИСК: Синхронизация ${ids.length} записей...`);
    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`UPDATE users SET balance=?, click_lvl=?, energy=?, last_active=? WHERE id=?`);
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) await stmt.run(d.balance, d.click_lvl, d.energy, d.last_active, id);
        }
        await stmt.finalize();
        await db.run('COMMIT');
        logger.info(`✅ ДИСК: Успешно записано.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("🛑 ДИСК: ОШИБКА: " + e.message);
    }
}
setInterval(flushToDisk, 30000);

// --- [6. БОТ] ---
bot.start((ctx) => {
    const uid = ctx.from.id;
    logger.info(`🤖 БОТ: /start от ${uid}`);
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE</b>\nСистема готова к работе.`, 
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", `${WEB_APP_URL}/?u=${uid}`)]]));
});

// --- [7. ЗАПУСК] ---
async function start() {
    await initDB();
    const PORT = 3000;
    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`🌐 СЕРВЕР: Запущен на порту ${PORT} | Panchenko Edition`);
    });
    bot.launch().then(() => logger.info("🤖 БОТ: Соединение установлено"));
}

start();
