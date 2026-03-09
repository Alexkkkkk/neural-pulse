const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAGb0-TC4z3uFK2glOUJeU_wHnr27474zzQ";
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
app.use(express.json());

// Логируем каждый чих сети
app.use((req, res, next) => {
    logger.debug(`📡 СЕТЬ: ${req.method} ${req.url}`);
    next();
});

// Настройка статики: файлы из /static будут доступны по прямой ссылке /script.js и т.д.
app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [2. ИНИЦИАЛИЗАЦИЯ БД] ---
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
        logger.info("🚀 БД: СТАТУС - ONLINE (PnL Protocol Enabled)");
    } catch (err) { logger.error("❌ БД: ОШИБКА: " + err.message); }
}

// --- [3. ЛОГИКА ПАССИВНОГО ДОХОДА] ---
function calculateOfflineEarnings(user) {
    const now = Math.floor(Date.now() / 1000);
    const secondsOffline = now - user.last_active;
    
    if (secondsOffline > 0 && user.pnl > 0) {
        // Ограничим фарм оффлайн, например, 3 часами (10800 сек)
        const effectiveSeconds = Math.min(secondsOffline, 10800); 
        const earnings = (user.pnl / 3600) * effectiveSeconds;
        
        logger.info(`💰 PnL: Юзер ${user.id} отсутствовал ${secondsOffline}с. Начислено: +${earnings.toFixed(2)}`);
        return Number(earnings);
    }
    return 0;
}

// --- [4. API ЭНДПОИНТЫ] ---

app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    logger.debug(`👤 ИГРОК: Запрос данных для UID ${uid}`);
    try {
        let user = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const now = Math.floor(Date.now() / 1000);

        if (!user) {
            user = { id: uid, balance: 100, click_lvl: 1, pnl: 10, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, pnl, last_active) VALUES (?, 100, 10, ?)`, [uid, now]);
            logger.info(`🆕 ИГРОК: Создан профиль ${uid}`);
        } else {
            // Начисляем оффлайн доход
            const offlineIncome = calculateOfflineEarnings(user);
            user.balance += offlineIncome;
            user.last_active = now; // Обновляем время активности
        }
        
        userCache.set(uid, user);
        saveQueue.add(uid); // Сразу в очередь на сохранение новых данных
        res.json({ status: "ok", data: user });
    } catch (e) {
        logger.error(`❌ API: Ошибка баланса ${uid}: ${e.message}`);
        res.status(500).json({ status: "error" });
    }
});

app.post('/api/save', async (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    logger.debug(`📥 API: Сохранение прогресса UID ${uid} | Bal: ${score}`);
    try {
        let user = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        if (user) {
            user.balance = Number(score);
            user.energy = Number(energy);
            user.last_active = Math.floor(Date.now() / 1000);
            userCache.set(uid, user);
            saveQueue.add(uid);
            res.json({ status: "ok" });
        } else {
            res.status(404).json({ status: "error" });
        }
    } catch (e) { res.status(500).json({ status: "error" }); }
});

// Апгрейд PnL (Пассивного дохода)
app.post('/api/upgrade/pnl', async (req, res) => {
    const { user_id } = req.body;
    const uid = String(user_id);
    logger.debug(`📈 API: Запрос UPGRADE PnL для ${uid}`);
    try {
        let user = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        const cost = (user.pnl || 10) * 15; // Цена зависит от текущего PnL
        
        if (user.balance >= cost) {
            user.balance -= cost;
            user.pnl = (user.pnl || 0) + 50; // Добавляем +50 в час
            userCache.set(uid, user);
            saveQueue.add(uid);
            logger.info(`✅ UPGRADE PnL: UID ${uid} -> New PnL: ${user.pnl}`);
            res.json({ status: "ok", new_pnl: user.pnl, new_balance: user.balance });
        } else {
            res.status(400).json({ status: "error", message: "Low balance" });
        }
    } catch (e) { res.status(500).json({ status: "error" }); }
});

// --- [5. СИНХРОНИЗАЦИЯ] ---
async function flushToDisk() {
    if (saveQueue.size === 0) return;
    const ids = Array.from(saveQueue);
    saveQueue.clear();
    logger.info(`💾 ДИСК: Синхронизация ${ids.length} записей...`);
    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`UPDATE users SET balance=?, click_lvl=?, pnl=?, energy=?, last_active=? WHERE id=?`);
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) await stmt.run(d.balance, d.click_lvl, d.pnl, d.energy, d.last_active, id);
        }
        await stmt.finalize();
        await db.run('COMMIT');
        logger.info(`✅ ДИСК: Успешно записано.`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("🛑 ДИСК: ОШИБКА: " + e.message);
    }
}
setInterval(flushToDisk, 20000);

// --- [6. БОТ] ---
bot.start((ctx) => {
    logger.info(`🤖 БОТ: /start от ${ctx.from.id}`);
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE</b>\nПротокол PnL активирован. Твои шахты работают, пока ты спишь.`, 
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", `${WEB_APP_URL}/?u=${ctx.from.id}`)]]));
});

// --- [7. ЗАПУСК] ---
async function start() {
    await initDB();
    server.listen(3000, '0.0.0.0', () => {
        logger.info(`🌐 СЕРВЕР: LIVE на порту 3000 | PnL Edition`);
    });
    bot.launch();
}

start();
