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

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

app.use(cors());
app.use(express.json({ limit: '15kb' }));

// Логируем абсолютно каждый запрос для поиска "дыр"
app.use((req, res, next) => {
    logger.debug(`📡 СЕТЬ: ${req.method} ${req.url} | Headers: ${JSON.stringify(req.headers['x-tg-data'] ? 'PRESENT' : 'MISSING')}`);
    next();
});

app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [2. ВЕРИФИКАЦИЯ] ---
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

// --- [3. ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
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
    } catch (err) { logger.error("❌ БД: ОШИБКА: " + err.message); }
}

// --- [4. API ЭНДПОИНТЫ] ---

// Получение баланса
app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    try {
        let userData = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        if (!userData) {
            const now = Math.floor(Date.now() / 1000);
            userData = { id: uid, balance: 100, click_lvl: 1, pnl: 0, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, last_active) VALUES (?, 100, ?)`, [uid, now]);
            logger.info(`🆕 ИГРОК: Создан профиль ${uid}`);
        }
        userCache.set(uid, userData);
        res.json({ status: "ok", data: userData });
    } catch (e) {
        logger.error(`❌ API ERROR (Balance): ${e.message}`);
        res.status(500).json({ status: "error", message: e.message });
    }
});

// Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { user_id, score, energy, initData } = req.body;
    // Проверка подписи (если фронт ее присылает в теле или заголовке)
    if (initData && !verifyTelegramWebAppData(initData)) {
        logger.warn(`🛡 SECURITY: Неверная подпись для ${user_id}`);
    }

    const uid = String(user_id);
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

// ДОБАВЛЯЕМ НЕДОСТАЮЩИЙ ЭНДПОИНТ (на который ругались логи)
app.post('/api/upgrade/click', async (req, res) => {
    const { user_id } = req.body;
    const uid = String(user_id);
    logger.debug(`🛠 UPGRADE: Запрос на улучшение клика для ${uid}`);
    try {
        let user = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const cost = (user.click_lvl || 1) * 500;
        
        if (user.balance >= cost) {
            user.balance -= cost;
            user.click_lvl = (user.click_lvl || 1) + 1;
            userCache.set(uid, user);
            saveQueue.add(uid);
            logger.info(`✅ UPGRADE: ${uid} поднял уровень до ${user.click_lvl}`);
            res.json({ status: "ok", new_lvl: user.click_lvl, new_balance: user.balance });
        } else {
            res.status(400).json({ status: "error", message: "Insufficient funds" });
        }
    } catch (e) { res.status(500).json({ status: "error" }); }
});

// --- [5. СИНХРОНИЗАЦИЯ] ---
async function flushToDisk() {
    if (saveQueue.size === 0) return;
    const ids = Array.from(saveQueue);
    saveQueue.clear();
    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`UPDATE users SET balance=?, click_lvl=?, energy=?, last_active=? WHERE id=?`);
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) await stmt.run(d.balance, d.click_lvl, d.energy, d.last_active, id);
        }
        await stmt.finalize();
        await db.run('COMMIT');
        logger.info(`💾 ДИСК: Синхронизировано ${ids.length} чел.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("🛑 ДИСК ERROR: " + e.message);
    }
}
setInterval(flushToDisk, 20000);

// --- [6. ЗАПУСК] ---
bot.start((ctx) => {
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE</b>\nПротокол готов.`, 
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", `${WEB_APP_URL}/?u=${ctx.from.id}`)]]));
});

async function start() {
    await initDB();
    server.listen(3000, '0.0.0.0', () => logger.info(`🌐 ПОРТ 3000 LIVE` Panchenko Edition));
    bot.launch();
}
start();
