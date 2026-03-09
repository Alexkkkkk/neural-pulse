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
    level: 'debug', // Уровень debug для максимальной детализации
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

logger.info("🛠 Инициализация системы Neural Pulse...");

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
        logger.warn(`⚠️ LIMIT: IP ${req.ip} превысил лимит запросов`);
        res.status(429).json({ error: "Too many requests" });
    }
});

app.use(cors());
app.use(express.json({ limit: '15kb' }));
app.use((req, res, next) => {
    logger.debug(`📡 Входящий запрос: ${req.method} ${req.url} | IP: ${req.ip}`);
    next();
});
app.use('/api/', limiter);
app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [2. БЕЗОПАСНОСТЬ: ДОСКОНАЛЬНАЯ ПРОВЕРКА] ---
function verifyTelegramWebAppData(telegramInitData) {
    logger.debug("🔐 Начинаю проверку подписи WebApp...");
    if (!telegramInitData) {
        logger.error("❌ Данные инициализации отсутствуют");
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
        logger.debug(isValid ? "✅ Подпись верна" : "❌ Подпись не совпадает!");
        return isValid;
    } catch (e) {
        logger.error(`❌ Ошибка криптографии: ${e.message}`);
        return false;
    }
}

const validateUser = (req, res, next) => {
    const initData = req.headers['x-tg-data'];
    logger.debug("🛡 Валидация заголовка x-tg-data...");
    if (!initData || !verifyTelegramWebAppData(initData)) {
        return res.status(403).json({ error: "Invalid Neural Signature" });
    }
    next();
};

// --- [3. БАЗА ДАННЫХ С ЛОГАМИ ШАГОВ] ---
async function initDB() {
    const dataDir = path.join(__dirname, 'data');
    logger.debug(`📁 Проверка директории БД: ${dataDir}`);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info("📁 Директория данных создана");
    }
    
    try {
        logger.debug("🗄 Открытие файла game.db...");
        db = await open({ filename: path.join(dataDir, 'game.db'), driver: sqlite3.Database });
        
        logger.debug("⚙️ Настройка PRAGMA (WAL Mode)...");
        await db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`);
        
        logger.debug("🔨 Проверка/Создание таблицы users...");
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
        logger.info("🚀 Neural Core DB: ONLINE");
    } catch (err) {
        logger.error("❌ КРИТИЧЕСКАЯ ОШИБКА БД: " + err.message);
    }
}

// --- [4. API ЭНДПОИНТЫ С ТРЕКИНГОМ] ---

app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    logger.debug(`👤 Запрос баланса для пользователя: ${uid}`);
    try {
        let userData = userCache.get(uid);
        if (userData) {
            logger.debug(`💾 Данные взяты из кэша для ${uid}`);
        } else {
            logger.debug(`🔎 Поиск ${uid} в БД...`);
            userData = await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        }

        const now = Math.floor(Date.now() / 1000);
        if (!userData) {
            logger.info(`🆕 Регистрация нового агента: ${uid}`);
            userData = { id: uid, balance: 100, click_lvl: 1, pnl: 0, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, last_active) VALUES (?, 100, ?)`, [uid, now]);
        }
        
        userCache.set(uid, userData);
        res.json({ status: "ok", data: userData });
    } catch (e) { 
        logger.error(`❌ Ошибка /api/balance: ${e.message}`);
        res.status(500).json({ error: "Sync Error" }); 
    }
});

app.post('/api/save', validateUser, async (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    logger.debug(`📥 Попытка сохранения: UID ${uid} | Score ${score} | Energy ${energy}`);
    try {
        let current = userCache.get(uid);
        if (current) {
            current.balance = Math.max(current.balance, Number(score));
            current.energy = Number(energy);
            current.last_active = Math.floor(Date.now() / 1000);
            userCache.set(uid, current);
            saveQueue.add(uid);
            logger.debug(`✅ UID ${uid} добавлен в очередь на сохранение (Очередь: ${saveQueue.size})`);
        } else {
            logger.warn(`⚠️ UID ${uid} не найден в кэше при сохранении`);
        }
        res.json({ status: "pulse_received" });
    } catch (e) { 
        logger.error(`❌ Ошибка /api/save: ${e.message}`);
        res.status(500).json({ error: "Save Fail" }); 
    }
});

// --- [5. СИНХРОНИЗАЦИЯ С ЛОГИРОВАНИЕМ ШАГОВ ТРАНЗАКЦИИ] ---
async function flushToDisk() {
    if (saveQueue.size === 0) {
        logger.debug("⏲ Синхронизация: очередь пуста, пропускаю.");
        return;
    }
    const ids = Array.from(saveQueue);
    saveQueue.clear();
    logger.info(`💾 Начинаю сброс данных на диск для ${ids.length} агентов...`);
    
    try {
        logger.debug("📝 Начало транзакции BEGIN TRANSACTION");
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`UPDATE users SET balance=?, energy=?, last_active=? WHERE id=?`);
        
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) {
                await stmt.run(d.balance, d.energy, d.last_active, id);
                logger.debug(`   -> Записан: ${id} (Bal: ${d.balance})`);
            }
        }
        await stmt.finalize();
        await db.run('COMMIT');
        logger.info(`✅ Успешно синхронизировано: ${ids.length} записей.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("🛑 ОШИБКА ЗАПИСИ: " + e.message);
        ids.forEach(id => saveQueue.add(id)); 
    }
}
setInterval(flushToDisk, 30000);

// --- [6. БОТ И ЗАПУСК] ---
bot.start((ctx) => {
    const uid = String(ctx.from.id);
    logger.info(`🤖 Команда /start от пользователя: ${uid} (@${ctx.from.username || 'N/A'})`);
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE</b>\nДобро пожаловать в систему.`, 
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", `${WEB_APP_URL}/?u=${uid}`)]]));
});

async function start() {
    logger.info("📡 Запуск Neural Core...");
    await initDB();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`🌐 СЕРВЕР ЗАПУЩЕН | Порт: ${PORT}`);
        logger.info(`🔗 WebApp URL: ${WEB_APP_URL}`);
    });
    
    logger.debug("🔌 Запуск Telegraf Bot...");
    bot.launch({ dropPendingUpdates: true })
        .then(() => logger.info("🤖 Бот успешно подключен к Telegram API"))
        .catch(e => logger.error(`❌ Ошибка запуска бота: ${e.message}`));
}

start();
