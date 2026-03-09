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

// --- [1. КОНФИГУРАЦИЯ И ГЛУБОКОЕ ЛОГИРОВАНИЕ] ---
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

logger.info("🛠 СИСТЕМА: Запуск процесса инициализации...");

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
        logger.warn(`⚠️ SECURITY: Превышен лимит запросов для IP ${req.ip}`);
        res.status(429).json({ error: "System overloaded" });
    }
});

app.use(cors());
app.use(express.json({ limit: '15kb' }));
app.use((req, res, next) => {
    logger.debug(`📡 СЕТЬ: ${req.method} ${req.url} от ${req.ip}`);
    next();
});
app.use('/api/', limiter);
app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [2. БЕЗОПАСНОСТЬ: ВЕРИФИКАЦИЯ] ---
function verifyTelegramWebAppData(telegramInitData) {
    logger.debug("🔐 БЕЗОПАСНОСТЬ: Проверка подписи WebApp...");
    if (!telegramInitData) {
        logger.error("❌ БЕЗОПАСНОСТЬ: Данные initData отсутствуют!");
        return false;
    }
    try {
        const urlParams = new URLSearchParams(telegramInitData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        urlParams.sort();
        let dataCheckString = Array.from(urlParams.entries()).map(([k, v]) => `${k}=${v}`).join('\n');
        
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(API_TOKEN).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        
        const isValid = hmac === hash;
        logger.debug(isValid ? "✅ БЕЗОПАСНОСТЬ: Подпись подтверждена" : "❌ БЕЗОПАСНОСТЬ: Подпись ПОДДЕЛАНА!");
        return isValid;
    } catch (e) {
        logger.error(`❌ БЕЗОПАСНОСТЬ: Ошибка криптографии: ${e.message}`);
        return false;
    }
}

const validateUser = (req, res, next) => {
    const initData = req.headers['x-tg-data'];
    logger.debug("🛡 API: Валидация заголовка x-tg-data...");
    if (!initData || !verifyTelegramWebAppData(initData)) {
        return res.status(403).json({ error: "Neural link refused" });
    }
    next();
};

// --- [3. БАЗА ДАННЫХ: ЖЕСТКИЙ КОНТРОЛЬ] ---
async function initDB() {
    const dataDir = path.join(__dirname, 'data');
    logger.debug(`📁 ФАЙЛЫ: Проверка папки БД по пути: ${dataDir}`);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info("📁 ФАЙЛЫ: Создана новая директория для данных");
    }
    
    try {
        logger.debug("🗄 БД: Подключение к game.db...");
        db = await open({ filename: path.join(dataDir, 'game.db'), driver: sqlite3.Database });
        
        logger.debug("⚙️ БД: Установка режимов WAL и NORMAL...");
        await db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`);
        
        logger.debug("🔨 БД: Синхронизация структуры таблиц...");
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, 
                balance REAL DEFAULT 0, 
                click_lvl INTEGER DEFAULT 1,
                pnl REAL DEFAULT 0, 
                energy REAL DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,
                last_active INTEGER, 
                referrer_id TEXT
            );
        `);
        logger.info("🚀 БД: СТАТУС - ONLINE");
    } catch (err) {
        logger.error("❌ БД: КРИТИЧЕСКИЙ СБОЙ: " + err.message);
        process.exit(1);
    }
}

// --- [4. API С ПОЛНЫМ ТРЕКИНГОМ] ---

app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    logger.debug(`👤 ИГРОК: Запрос данных профиля для UID ${uid}`);
    try {
        let userData = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const now = Math.floor(Date.now() / 1000);

        if (!userData) {
            logger.info(`🆕 ИГРОК: Регистрация нового агента в системе: ${uid}`);
            userData = { id: uid, balance: 100, click_lvl: 1, pnl: 0, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, last_active) VALUES (?, 100, ?)`, [uid, now]);
        }
        
        userCache.set(uid, userData);
        res.json({ status: "ok", data: userData });
    } catch (e) { 
        logger.error(`❌ API: Ошибка получения баланса ${uid}: ${e.message}`);
        res.status(500).json({ error: "Data link failure" }); 
    }
});

app.post('/api/save', validateUser, async (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    logger.debug(`📥 API: Сохранение пульса: UID ${uid} | Bal: ${score} | Eng: ${energy}`);
    try {
        let current = userCache.get(uid);
        if (current) {
            current.balance = Math.max(current.balance, Number(score));
            current.energy = Number(energy);
            current.last_active = Math.floor(Date.now() / 1000);
            userCache.set(uid, current);
            saveQueue.add(uid);
            logger.debug(`✅ API: Данные UID ${uid} помещены в очередь записи`);
        } else {
            logger.warn(`⚠️ API: Попытка сохранить данные для UID ${uid}, которого нет в кэше!`);
        }
        res.json({ status: "pulse_received" });
    } catch (e) { 
        logger.error(`❌ API: Ошибка сохранения ${uid}: ${e.message}`);
        res.status(500).json({ error: "Save transmission failed" }); 
    }
});

// --- [5. СИНХРОНИЗАЦИЯ: ВНУТРЕННЯЯ КУХНЯ БД] ---
async function flushToDisk() {
    if (saveQueue.size === 0) {
        logger.debug("⏲ ТАЙМЕР: Очередь записи пуста. Жду...");
        return;
    }
    const ids = Array.from(saveQueue);
    saveQueue.clear();
    logger.info(`💾 ДИСК: Начинаю физическую запись для ${ids.length} агентов...`);
    
    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`UPDATE users SET balance=?, energy=?, last_active=? WHERE id=?`);
        
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) {
                await stmt.run(d.balance, d.energy, d.last_active, id);
                logger.debug(`   -> БД ЗАПИСЬ: ID ${id} | Финальный баланс: ${d.balance.toFixed(2)}`);
            }
        }
        await stmt.finalize();
        await db.run('COMMIT');
        logger.info(`✅ ДИСК: Успешная синхронизация ${ids.length} записей.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("🛑 ДИСК: ОШИБКА ТРАНЗАКЦИИ: " + e.message);
        ids.forEach(id => saveQueue.add(id)); 
    }
}
setInterval(flushToDisk, 30000);

// --- [6. БОТ: ИНТЕРФЕЙС УПРАВЛЕНИЯ] ---
bot.start((ctx) => {
    const uid = String(ctx.from.id);
    logger.info(`🤖 БОТ: Команда /start от ${uid} (${ctx.from.username || 'Без имени'})`);
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE</b>\nПротокол активирован. Ожидаю подключения...`, 
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД В ЯДРО 🧠", `${WEB_APP_URL}/?u=${uid}`)]]));
});

// --- [7. ЗАПУСК ЯДРА] ---
async function start() {
    logger.info("📡 СИСТЕМА: Запуск Neural Pulse Core...");
    await initDB();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`🌐 СЕТЬ: СЕРВЕР LIVE | ПОРТ: ${PORT}`);
        logger.info(`🔗 СЕТЬ: URL WEBAPP: ${WEB_APP_URL}`);
    });
    
    bot.launch({ dropPendingUpdates: true })
        .then(() => logger.info("🤖 БОТ: Соединение с Telegram API установлено"))
        .catch(e => logger.error(`❌ БОТ: Ошибка запуска: ${e.message}`));
}

start();
