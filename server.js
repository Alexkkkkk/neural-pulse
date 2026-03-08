const express = require('express');
const http = require('http');
const path = require('path');
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

// Раздача статики (картинки, манифест)
app.use('/static', express.static(path.join(__dirname, 'static')));

// --- [КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: ОТДАЧА INDEX.HTML] ---
// Без этого блока ссылка в Telegram не откроется
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

let db;
const saveQueue = new Map();

// --- [СИСТЕМА УМНОГО ЛОГИРОВАНИЯ] ---
const logger = {
    info: (msg, data = '') => console.log(`[${new Date().toISOString()}] 🟦 INFO: ${msg}`, data),
    success: (msg, data = '') => console.log(`[${new Date().toISOString()}] 🟩 SUCCESS: ${msg}`, data),
    warn: (msg, data = '') => console.warn(`[${new Date().toISOString()}] 🟧 WARN: ${msg}`, data),
    error: (msg, err = '') => console.error(`[${new Date().toISOString()}] 🟥 ERROR: ${msg}`, err),
    debug: (msg, data = '') => console.debug(`[${new Date().toISOString()}] 🟪 DEBUG: ${msg}`, data)
};

// --- [ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    try {
        logger.info("Попытка инициализации базы данных...");
        db = await open({
            filename: path.join(__dirname, 'data', 'game.db'),
            driver: sqlite3.Database
        });
        
        await db.run('PRAGMA journal_mode = WAL');
        await db.run('PRAGMA synchronous = NORMAL');
        await db.run('PRAGMA cache_size = -64000'); 

        await db.exec(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, 
            balance REAL, 
            click_lvl INTEGER, 
            pnl REAL DEFAULT 0, 
            energy REAL, 
            max_energy INTEGER, 
            level INTEGER DEFAULT 1, 
            last_active INTEGER)`);

        await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_id ON users (id)`);
        logger.success("База данных готова и оптимизирована (WAL Mode ON)");
    } catch (err) {
        logger.error("КРИТИЧЕСКАЯ ОШИБКА БД:", err);
    }
}

// --- [ЛОГИКА ПАКЕТНОГО СОХРАНЕНИЯ] ---
async function flushQueue() {
    const count = saveQueue.size;
    if (count === 0) {
        logger.debug("Очередь сохранения пуста. Пропуск.");
        return;
    }

    const startTime = Date.now();
    const users = Array.from(saveQueue.entries());
    saveQueue.clear();

    logger.info(`Начало пакетного сохранения для ${count} пользователей...`);

    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`
            UPDATE users SET 
                balance = ?, click_lvl = ?, pnl = ?, 
                energy = ?, level = ?, last_active = ? 
            WHERE id = ?
        `);

        for (const [id, d] of users) {
            await stmt.run(d.balance, d.click_lvl, d.pnl, d.energy, d.level, d.last_active, id);
        }

        await stmt.finalize();
        await db.run('COMMIT');
        
        const duration = Date.now() - startTime;
        logger.success(`Пакетное сохранение завершено успешно за ${duration}мс`);
    } catch (e) {
        if (db) await db.run('ROLLBACK');
        logger.error("ОШИБКА ПАКЕТНОГО СОХРАНЕНИЯ!", e.message);
        users.forEach(([id, d]) => { if(!saveQueue.has(id)) saveQueue.set(id, d); });
    }
}

setInterval(flushQueue, 15000);

// --- [API ЭНДПОИНТЫ] ---

app.get('/api/balance/:userId', async (req, res) => {
    const userId = String(req.params.userId);
    try {
        let userData = saveQueue.get(userId) || await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        const now = Math.floor(Date.now() / 1000);

        if (userData) {
            const score = userData.balance || 0;
            const offTime = Math.min(now - (userData.last_active || now), 10800);
            const earned = (userData.pnl / 3600) * offTime;
            
            logger.debug(`Запрос баланса: ID ${userId}. Начислено офлайн: ${earned.toFixed(2)}`);
            
            res.json({ status: "ok", data: {
                score: score + earned, 
                tap_power: userData.click_lvl,
                pnl: userData.pnl, 
                energy: userData.energy, 
                level: userData.level,
                max_energy: userData.max_energy,
                multiplier: 1
            }});
        } else {
            logger.info(`Регистрация нового пользователя: ${userId}`);
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, 1000, 1, 0, 1000, 1000, 1, ?)`, [userId, now]);
            res.json({ status: "ok", data: { score: 1000, tap_power: 1, pnl: 0, energy: 1000, max_energy: 1000, level: 1 }});
        }
    } catch (e) { 
        logger.error(`Ошибка API balance для юзера ${userId}:`, e);
        res.status(500).json({ error: "DB Error" }); 
    }
});

app.post('/api/save', (req, res) => {
    const d = req.body;
    if (!d.user_id || d.user_id === "guest") return res.json({status: "ignored"});

    saveQueue.set(String(d.user_id), {
        balance: parseFloat(d.score) || 0,
        click_lvl: parseInt(d.tap_power) || 1,
        pnl: parseFloat(d.pnl) || 0,
        energy: parseFloat(d.energy) || 0,
        level: parseInt(d.level) || 1,
        last_active: Math.floor(Date.now() / 1000)
    });

    res.json({ status: "queued" }); 
});

app.post('/api/upgrade/mine', async (req, res) => {
    const { user_id } = req.body;
    try {
        const user = await db.get('SELECT balance, pnl FROM users WHERE id = ?', [String(user_id)]);
        if (!user) return res.status(404).send("User not found");

        const currentLvl = Math.floor(user.pnl / 150);
        const cost = Math.floor(1000 * Math.pow(1.6, currentLvl));

        if (user.balance >= cost) {
            const newPnl = user.pnl + 150;
            const newBalance = user.balance - cost;
            await db.run('UPDATE users SET balance = ?, pnl = ? WHERE id = ?', [newBalance, newPnl, String(user_id)]);
            saveQueue.delete(String(user_id)); 
            logger.success(`ПОКУПКА: Юзер ${user_id} купил MINE. Баланс: ${newBalance}`);
            res.json({ status: "ok", newBalance, newPnl });
        } else {
            res.json({ status: "error", message: "Low balance" });
        }
    } catch (e) { 
        logger.error(`Ошибка при покупке MINE для ${user_id}:`, e);
        res.status(500).send(e.message); 
    }
});

bot.start((ctx) => {
    logger.info(`Команда /start от пользователя ${ctx.from.id}`);
    const url = `${WEB_APP_URL}/?u=${ctx.from.id}&v=${Math.random().toString(36).substring(7)}`;
    ctx.replyWithHTML(`🦾 <b>Neural Pulse Active</b>`, Markup.inlineKeyboard([
        [Markup.button.webApp("ВХОД 🧠", url)]
    ]));
});

// --- [ЗАПУСК С АВТОПОРТОМ] ---
// Bothost часто требует порт 80 или 8080 для внешнего доступа
const PORT = process.env.PORT || 3000; 

async function start() {
    await initDB();
    try {
        await bot.telegram.deleteWebhook();
        server.listen(PORT, '0.0.0.0', () => {
            logger.success(`🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT}`);
            logger.info(`URL ПРИЛОЖЕНИЯ: ${WEB_APP_URL}`);
        });
        bot.launch();
        logger.success("🤖 Телеграм-бот успешно запущен");
    } catch (e) {
        logger.error("Ошибка при запуске бота:", e);
    }
}

start();

async function shutdown(signal) {
    logger.warn(`Получен сигнал ${signal}. Завершение...`);
    await flushQueue();
    process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
