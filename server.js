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

// Настройка статики
app.use(express.static(path.join(__dirname, 'static')));

let db;
const userCache = new Map();
const saveQueue = new Set();

// --- [2. ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    const dataDir = '/app/data'; 
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
        logger.info("🚀 БД: СТАТУС - ONLINE (PnL Protocol Enabled)");
    } catch (err) { 
        logger.error("❌ БД: ОШИБКА: " + err.message); 
        process.exit(1);
    }
}

// --- [3. ЛОГИКА ДОХОДА И ЭНЕРГИИ] ---
function processOffline(user) {
    const now = Math.floor(Date.now() / 1000);
    const lastActive = user.last_active || now;
    const secondsOffline = now - lastActive;
    
    if (secondsOffline > 5) {
        // 1. Начисляем PnL (макс за 3 часа)
        if (user.pnl > 0) {
            const effectiveSeconds = Math.min(secondsOffline, 10800); 
            const earnings = (user.pnl / 3600) * effectiveSeconds;
            user.balance += Number(earnings);
        }

        // 2. Восстанавливаем энергию (3 ед/сек)
        const energyRegen = secondsOffline * 3;
        user.energy = Math.min(user.max_energy, (user.energy || 0) + energyRegen);
        
        user.last_active = now;
        return true;
    }
    return false;
}

// --- [4. API ЭНДПОИНТЫ] ---

app.get('/api/balance/:userId', async (req, res) => {
    const uid = String(req.params.userId);
    try {
        let user = userCache.get(uid) || await db.get('SELECT * FROM users WHERE id = ?', [uid]);
        
        if (!user) {
            const now = Math.floor(Date.now() / 1000);
            user = { id: uid, balance: 100, click_lvl: 1, pnl: 10, energy: 1000, max_energy: 1000, last_active: now };
            await db.run(`INSERT INTO users (id, balance, pnl, last_active, energy, max_energy, click_lvl) VALUES (?, 100, 10, ?, 1000, 1000, 1)`, [uid, now]);
            logger.info(`🆕 ИГРОК: Создан профиль ${uid}`);
        } else {
            processOffline(user);
        }
        
        userCache.set(uid, user);
        saveQueue.add(uid);
        res.json({ status: "ok", data: user });
    } catch (e) {
        logger.error(`❌ API: Ошибка баланса ${uid}: ${e.message}`);
        res.status(500).json({ status: "error" });
    }
});

app.post('/api/save', async (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    try {
        let user = userCache.get(uid);
        if (user) {
            user.balance = Number(score);
            user.energy = Number(energy);
            user.last_active = Math.floor(Date.now() / 1000);
            saveQueue.add(uid);
            res.json({ status: "ok" });
        } else {
            res.status(404).json({ status: "error" });
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
        const stmt = await db.prepare(`UPDATE users SET balance=?, click_lvl=?, pnl=?, energy=?, last_active=? WHERE id=?`);
        for (const id of ids) {
            const d = userCache.get(id);
            if (d) await stmt.run(d.balance, d.click_lvl, d.pnl, d.energy, d.last_active, id);
        }
        await stmt.finalize();
        await db.run('COMMIT');
        logger.debug(`💾 ДИСК: Синхронизировано ${ids.length} игроков`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("🛑 ДИСК: ОШИБКА: " + e.message);
    }
}
setInterval(flushToDisk, 20000);

// --- [6. БОТ] ---
bot.start((ctx) => {
    // Исправлено: Добавляем v=${Date.now()}, чтобы Telegram не кэшировал старый index.html
    const webAppUrlWithCacheBust = `${WEB_APP_URL}/?u=${ctx.from.id}&v=${Date.now()}`;
    
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE</b>\nПротокол PnL активирован. Твои шахты работают, пока ты спишь.`, 
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", webAppUrlWithCacheBust)]]));
});

// --- [7. ЗАПУСК] ---
async function start() {
    await initDB();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`🌐 СЕРВЕР: LIVE на порту ${PORT}`);
    });
    
    bot.launch().then(() => logger.info("🤖 БОТ: Запущен успешно")).catch(err => logger.error("🤖 БОТ: Ошибка запуска: " + err.message));
}

async function shutdown() {
    logger.info("🚀 ЗАВЕРШЕНИЕ: Сохранение данных...");
    await flushToDisk();
    if (db) await db.close();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
