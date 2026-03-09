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
const SECRET_PATH = "/webhook-tg-pulse";

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

logger.info("🛠 СИСТЕМА: Инициализация переменных окружения...");

const app = express();
app.set('trust proxy', 1); 
const server = http.createServer(app);
const bot = new Telegraf(API_TOKEN);

// --- [2. MIDDLEWARE & WEBHOOK] ---
app.use(cors());
logger.debug("🔧 MIDDLEWARE: CORS активирован");

// Глобальный перехватчик для отладки маршрутизации
app.use((req, res, next) => {
    logger.debug(`🔍 ТРАФИК: ${req.method} запрос на ${req.url} (IP: ${req.ip})`);
    next();
});

// Обработка вебхука
app.post(SECRET_PATH, (req, res, next) => {
    logger.info(`📥 WEBHOOK: Получен пакет данных от Telegram на ${SECRET_PATH}`);
    bot.webhookCallback(SECRET_PATH)(req, res, (err) => {
        if (err) {
            logger.error(`❌ WEBHOOK ERROR: Ошибка внутри callback: ${err.message}`);
            return next(err);
        }
        logger.debug(`📤 WEBHOOK: Callback Telegraf успешно завершен`);
    });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));
logger.debug("📂 СТАТИКА: Папка /static подключена");

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [3. БАЗА ДАННЫХ] ---
async function initDB() {
    logger.info("📦 БД: Попытка открытия файла базы...");
    const dataDir = path.join(__dirname, 'data'); 
    if (!fs.existsSync(dataDir)) {
        logger.warn("📁 БД: Папка /data не найдена, создаю...");
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    try {
        db = await open({ filename: path.join(dataDir, 'game.db'), driver: sqlite3.Database });
        logger.info("📦 БД: Файл открыт, проверка таблиц...");
        
        await db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, balance REAL DEFAULT 0, click_lvl INTEGER DEFAULT 1,
                pnl REAL DEFAULT 0, energy REAL DEFAULT 1000, max_energy INTEGER DEFAULT 1000, last_active INTEGER
            );
        `);
        logger.info("🚀 БД: Статус - ONLINE (WAL режим активен)");
    } catch (err) { 
        logger.error("❌ БД CRITICAL: Ошибка инициализации: " + err.message); 
        process.exit(1); 
    }
}

// --- [4. ЛОГИКА ДОХОДА] ---
function processOffline(user) {
    logger.debug(`⏳ ЛОГИКА: Расчет офлайн-дохода для игрока ${user.id}`);
    const now = Math.floor(Date.now() / 1000);
    const lastActive = parseInt(user.last_active) || now;
    const secondsOffline = now - lastActive;
    
    if (secondsOffline > 5) {
        const pnl = parseFloat(user.pnl) || 0;
        if (pnl > 0) {
            const effectiveTime = Math.min(secondsOffline, 10800);
            const earnings = (pnl / 3600) * effectiveTime;
            user.balance = (parseFloat(user.balance) || 0) + earnings;
            logger.debug(`💰 ЛОГИКА: Игрок ${user.id} заработал ${earnings.toFixed(2)} за ${effectiveTime}с`);
        }
        const regen = secondsOffline * 3;
        user.energy = Math.min(parseInt(user.max_energy) || 1000, (parseFloat(user.energy) || 0) + regen);
        user.last_active = now;
        return true;
    }
    return false;
}

// --- [5. API] ---
app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    logger.info(`📡 API GET: Запрос баланса для ID ${uid}`);
    try {
        let user = userCache.get(uid);
        if (user) logger.debug(`🧠 CACHE: Данные ${uid} взяты из памяти`);
        else {
            logger.debug(`🔎 БД: Поиск игрока ${uid} в таблице...`);
            user = await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        }

        if (!user) {
            logger.warn(`🆕 API: Игрок ${uid} не найден, создаю новый профиль...`);
            const now = Math.floor(Date.now() / 1000);
            user = { id: uid, balance: 100, click_lvl: 1, pnl: 10, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, pnl, last_active, energy, max_energy, click_lvl) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [uid, user.balance, user.pnl, user.last_active, user.energy, user.max_energy, user.click_lvl]);
            logger.info(`✅ API: Профиль ${uid} успешно сохранен в БД`);
        } else {
            processOffline(user);
        }
        userCache.set(uid, user);
        res.json({ status: "ok", data: user });
    } catch (e) { 
        logger.error(`❌ API ERROR: Сбой /api/balance: ${e.message}`);
        res.status(500).json({ status: "error" }); 
    }
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    logger.debug(`📡 API POST: Попытка сохранения для ${uid} (Score: ${score})`);
    const user = userCache.get(uid);
    if (user) {
        user.balance = parseFloat(score);
        user.energy = parseFloat(energy);
        user.last_active = Math.floor(Date.now() / 1000);
        saveQueue.add(uid);
        logger.debug(`📝 QUEUE: ${uid} добавлен в очередь на синхронизацию`);
        res.json({ status: "ok" });
    } else {
        logger.error(`❌ API SAVE ERROR: Игрок ${uid} не найден в кеше!`);
        res.status(404).json({ status: "error" });
    }
});

// --- [6. СИНХРОНИЗАЦИЯ] ---
async function flush() {
    if (saveQueue.size === 0) return;
    logger.debug(`💾 SYNC: Начало выгрузки очереди (${saveQueue.size} игроков)...`);
    const ids = Array.from(saveQueue); 
    saveQueue.clear();
    try {
        await db.run('BEGIN TRANSACTION');
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) await db.run(`UPDATE users SET balance=?, click_lvl=?, pnl=?, energy=?, last_active=? WHERE id=?`, 
                [d.balance, d.click_lvl, d.pnl, d.energy, d.last_active, id]);
        }
        await db.run('COMMIT');
        logger.info(`💾 SYNC: Успешно обновлено записей: ${ids.length}`);
    } catch (e) { 
        if (db) await db.run('ROLLBACK'); 
        logger.error(`🛑 SYNC ERROR: Ошибка записи на диск: ${e.message}`);
    }
}
setInterval(flush, 20000);

// --- [7. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    logger.info(`🤖 BOT: Получена команда /start от пользователя ${ctx.from.id}`);
    try {
        const uid = ctx.from.id;
        const webAppUrl = `${WEB_APP_URL}/?u=${uid}&v=${Date.now()}`;
        logger.debug(`🔗 BOT: Генерация ссылки Mini App: ${webAppUrl}`);
        
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE</b>\n\nПротокол активирован. Твой ID: <code>${uid}</code>`, 
            Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrl)]])
        );
        logger.info(`✅ BOT: Ответ на /start отправлен пользователю ${uid}`);
    } catch (e) { 
        logger.error(`❌ BOT ERROR: Не удалось отправить сообщение: ${e.message}`); 
    }
});

// --- [8. ЗАПУСК] ---
async function start() {
    logger.info("🎬 СТАРТ: Запуск основного процесса...");
    await initDB();
    
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`🌐 СЕРВЕР: Слушает порт ${PORT}`);
        try {
            logger.info("🤖 БОТ: Настройка Webhook...");
            await bot.telegram.setWebhook(`${WEB_APP_URL}${SECRET_PATH}`, {
                drop_pending_updates: true,
                allowed_updates: ['message', 'callback_query']
            });
            const info = await bot.telegram.getWebhookInfo();
            logger.info(`🤖 БОТ: Webhook установлен успешно! Текущий URL: ${info.url}`);
            if (info.pending_update_count > 0) {
                logger.warn(`⚠️ БОТ: В очереди Telegram висит ${info.pending_update_count} сообщений`);
            }
        } catch (err) { 
            logger.error(`🤖 БОТ CRITICAL ERROR: Ошибка настройки вебхука: ${err.message}`); 
        }
    });
}

const shutdown = async () => {
    logger.warn("🚀 ЗАВЕРШЕНИЕ: Получен сигнал на остановку...");
    await flush();
    if (db) {
        await db.close();
        logger.info("📦 БД: Соединение закрыто");
    }
    logger.info("👋 СИСТЕМА: Работа завершена");
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
