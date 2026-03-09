const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAGb0-TC4z3uFK2glOUJeU_wHnr27474zzQ";
const WEB_APP_URL = "https://np.bothost.ru"; 
const PORT = process.env.PORT || 3000;

// Фиксируем секретный путь, чтобы он был постоянным
const SECRET_PATH = `/telegraf/7659a15effe06d8b7c88477cbafce593ca20cefc052d061b5beafae78d9a1cde`;

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

// --- [2. MIDDLEWARE ПОРЯДОК ВАЖЕН] ---
app.use(cors());

// Логирование всех входящих POST запросов для отладки Webhook
app.post('*', (req, res, next) => {
    if (req.url.startsWith('/telegraf')) {
        logger.debug(`📥 Входящий запрос от Telegram на: ${req.url}`);
    }
    next();
});

// ВАЖНО: Вебхук должен идти ДО express.json(), если Telegraf сам парсит тело запроса
app.use(bot.webhookCallback(SECRET_PATH));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [3. ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    const dataDir = path.join(__dirname, 'data'); 
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    
    try {
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
                last_active INTEGER
            );
        `);
        logger.info("🚀 БД: СТАТУС - ONLINE");
    } catch (err) { 
        logger.error("❌ БД: ОШИБКА: " + err.message); 
        process.exit(1);
    }
}

// --- [4. ЛОГИКА ДОХОДА] ---
function processOffline(user) {
    const now = Math.floor(Date.now() / 1000);
    const lastActive = parseInt(user.last_active) || now;
    const secondsOffline = now - lastActive;
    
    if (secondsOffline > 5) {
        const pnl = parseFloat(user.pnl) || 0;
        if (pnl > 0) {
            const effectiveSeconds = Math.min(secondsOffline, 10800); 
            const earnings = (pnl / 3600) * effectiveSeconds;
            user.balance = (parseFloat(user.balance) || 0) + earnings;
        }
        const energyRegen = secondsOffline * 3;
        const maxEnergy = parseInt(user.max_energy) || 1000;
        user.energy = Math.min(maxEnergy, (parseFloat(user.energy) || 0) + energyRegen);
        user.last_active = now;
        return true;
    }
    return false;
}

// --- [5. API] ---
app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    try {
        let user = userCache.get(uid);
        if (!user) user = await db.get('SELECT * FROM users WHERE id = ?', [uid]);

        if (!user) {
            const now = Math.floor(Date.now() / 1000);
            user = { id: uid, balance: 100.0, click_lvl: 1, pnl: 10.0, energy: 1000.0, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, pnl, last_active, energy, max_energy, click_lvl) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [uid, user.balance, user.pnl, user.last_active, user.energy, user.max_energy, user.click_lvl]);
            logger.info(`🆕 ИГРОК: Создан профиль ${uid}`);
        } else {
            processOffline(user);
        }
        
        userCache.set(uid, user);
        res.json({ status: "ok", data: user });
    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

app.post('/api/save', async (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    try {
        let user = userCache.get(uid);
        if (user) {
            user.balance = parseFloat(score);
            user.energy = parseFloat(energy);
            user.last_active = Math.floor(Date.now() / 1000);
            saveQueue.add(uid);
            res.json({ status: "ok" });
        } else {
            res.status(404).json({ status: "error" });
        }
    } catch (e) { res.status(500).json({ status: "error" }); }
});

// --- [6. СИНХРОНИЗАЦИЯ] ---
async function flushToDisk() {
    if (saveQueue.size === 0) return;
    const ids = Array.from(saveQueue);
    saveQueue.clear();
    try {
        await db.run('BEGIN TRANSACTION');
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) await db.run(`UPDATE users SET balance = ?, click_lvl = ?, pnl = ?, energy = ?, last_active = ? WHERE id = ?`,
                [d.balance, d.click_lvl, d.pnl, d.energy, d.last_active, id]);
        }
        await db.run('COMMIT');
        logger.debug(`💾 ДИСК: Синхронизировано ${ids.length} игроков`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("🛑 ДИСК: ОШИБКА: " + e.message);
    }
}
setInterval(flushToDisk, 20000);

// --- [7. ЛОГИКА БОТА] ---
bot.start((ctx) => {
    logger.info(`✅ БОТ: Получена команда /start от ${ctx.from.id}`);
    const uid = ctx.from.id;
    const webAppUrlWithParams = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
    
    ctx.replyWithHTML(
        `🦾 <b>NEURAL PULSE</b>\n\nПротокол PnL активирован. Твои шахты работают, пока ты спишь.\n\n<i>Твой ID: ${uid}</i>`, 
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrlWithParams)]])
    ).catch(err => logger.error(`❌ Ошибка отправки ответа: ${err.message}`));
});

// --- [8. ЗАПУСК СЕРВЕРА] ---
async function start() {
    await initDB();
    
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 СЕРВЕР: LIVE на порту ${PORT}`);
        
        try {
            // Принудительно ставим вебхук при каждом запуске
            const webhookFullUrl = `${WEB_APP_URL}${SECRET_PATH}`;
            await bot.telegram.setWebhook(webhookFullUrl, {
                drop_pending_updates: true // Очищаем старые «зависшие» нажатия
            });
            logger.info(`🤖 БОТ: Webhook установлен: ${webhookFullUrl}`);
        } catch (err) {
            logger.error(`🤖 БОТ: Ошибка Webhook: ${err.message}`);
        }
    });
}

async function shutdown() {
    logger.info("🚀 ЗАВЕРШЕНИЕ...");
    await flushToDisk();
    if (db) await db.close();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
