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
app.use('/static', express.static(path.join(__dirname, 'static')));

let db;
// Очередь для пакетного сохранения (InMemory Cache)
const saveQueue = new Map();

// --- [ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    try {
        db = await open({
            filename: path.join(__dirname, 'data', 'game.db'),
            driver: sqlite3.Database
        });
        
        // Оптимизация SQLite для параллельной работы
        await db.run('PRAGMA journal_mode = WAL');
        await db.run('PRAGMA synchronous = NORMAL');
        await db.run('PRAGMA cache_size = -64000'); // 64MB кэша БД

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
        console.log("💾 Database Optimized for High-Load");
    } catch (err) {
        console.error("![DB] Init Error:", err);
    }
}

// --- [ЛОГИКА ПАКЕТНОГО СОХРАНЕНИЯ] ---
async function flushQueue() {
    if (saveQueue.size === 0) return;

    const users = Array.from(saveQueue.entries());
    saveQueue.clear();

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
        // Логируем только в режиме отладки, чтобы не забивать диск
    } catch (e) {
        await db.run('ROLLBACK');
        console.error("![BATCH] Save Error:", e.message);
    }
}

// Сброс данных в БД каждые 15 секунд
setInterval(flushQueue, 15000);

// --- [API ЭНДПОИНТЫ] ---

app.get('/api/balance/:userId', async (req, res) => {
    const userId = String(req.params.userId);
    try {
        // Сначала проверяем, нет ли данных в очереди (самые свежие)
        let userData = saveQueue.get(userId);
        
        if (!userData) {
            userData = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        }

        const now = Math.floor(Date.now() / 1000);

        if (userData) {
            const score = userData.balance || userData.score; // Совместимость имен
            const offTime = Math.min(now - (userData.last_active || now), 10800);
            const earned = (userData.pnl / 3600) * offTime;
            
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
            // Регистрация нового юзера
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, 1000, 1, 0, 1000, 1000, 1, ?)`, [userId, now]);
            res.json({ status: "ok", data: { score: 1000, tap_power: 1, pnl: 0, energy: 1000, max_energy: 1000, level: 1 }});
        }
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/save', (req, res) => {
    const d = req.body;
    if (!d.user_id || d.user_id === "guest") return res.json({status: "ignored"});

    // Мгновенная запись в память (Cache-aside)
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

// Магазин (оставляем прямой записью для безопасности транзакций покупок)
app.post('/api/upgrade/mine', async (req, res) => {
    const { user_id } = req.body;
    try {
        const user = await db.get('SELECT balance, pnl FROM users WHERE id = ?', [String(user_id)]);
        if (!user) return res.status(404).send("User not found");

        const currentLvl = Math.floor(user.pnl / 150);
        const cost = Math.floor(1000 * Math.pow(1.6, currentLvl));

        if (user.balance >= cost) {
            await db.run('UPDATE users SET balance = balance - ?, pnl = pnl + 150 WHERE id = ?', [cost, String(user_id)]);
            // Очищаем из очереди, чтобы не затереть старым балансом при следующем батче
            saveQueue.delete(String(user_id)); 
            res.json({ status: "ok" });
        } else {
            res.json({ status: "error", message: "Low balance" });
        }
    } catch (e) { res.status(500).send(e.message); }
});

bot.start((ctx) => {
    const url = `${WEB_APP_URL}/?u=${ctx.from.id}&v=${Math.random().toString(36).substring(7)}`;
    ctx.replyWithHTML(`🦾 <b>Neural Pulse Active</b>`, Markup.inlineKeyboard([
        [Markup.button.webApp("ВХОД 🧠", url)]
    ]));
});

// --- [ЗАПУСК] ---
async function start() {
    await initDB();
    await bot.telegram.deleteWebhook();
    server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Cluster Node Active on ${PORT}`));
    bot.launch();
}

const PORT = process.env.PORT || 3000;
start();

// Обработка корректного завершения (сохраняем кэш перед выходом)
async function shutdown(signal) {
    console.log(`[${signal}] Сохранение данных перед выходом...`);
    await flushQueue();
    process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
