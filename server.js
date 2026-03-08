const express = require('express');
const http = require('http');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { Server } = require('socket.io');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

// --- [КОНФИГУРАЦИЯ] ---
const API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM";
const WEB_APP_URL = "https://np.bothost.ru"; 

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const bot = new Telegraf(API_TOKEN);

app.use(cors());
app.use(express.json());

// Логируем только важные ошибки, а не каждый GET запрос (экономим ресурсы)
app.use('/static', express.static(path.join(__dirname, 'static')));

let db;

// --- [ИНИЦИАЛИЗАЦИЯ БД С ОПТИМИЗАЦИЕЙ] ---
async function initDB() {
    try {
        db = await open({
            filename: path.join(__dirname, 'data', 'game.db'),
            driver: sqlite3.Database
        });
        
        // Включаем режим WAL для конкурентной работы (чтение + запись)
        await db.run('PRAGMA journal_mode = WAL');
        await db.run('PRAGMA synchronous = NORMAL');

        await db.exec(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, 
            balance REAL, 
            click_lvl INTEGER, 
            pnl REAL DEFAULT 0, 
            energy REAL, 
            max_energy INTEGER, 
            level INTEGER DEFAULT 1, 
            last_active INTEGER)`);

        // КРИТИЧЕСКИ ВАЖНО для 20 млн пользователей: ИНДЕКС
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_id ON users (id)`);
        
        console.log("💾 Database & Tables Ready with WAL Mode");
    } catch (err) {
        console.error("![DB] Ошибка инициализации:", err);
    }
}

// --- [ЛОГИКА ТЕЛЕГРАМ БОТА] ---
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const version = Math.random().toString(36).substring(7);
    const webAppUrlWithCacheReset = `${WEB_APP_URL}/?u=${uid}&v=${version}`;

    try {
        await ctx.replyWithHTML(
            `🦾 <b>Neural Pulse: Протокол Запущен</b>\n\nДобро пожаловать в систему, нейро-майнер!`,
            Markup.inlineKeyboard([
                [Markup.button.webApp("ВХОД В НЕЙРОСЕТЬ 🧠", webAppUrlWithCacheReset)],
                [Markup.button.url("КАНАЛ ПРОЕКТА 📢", "https://t.me/neural_pulse")]
            ])
        );
    } catch (e) {
        console.error("[BOT] Start Error:", e.message);
    }
});

// --- [API ЭНДПОИНТЫ] ---

// 1. Баланс и Офлайн-доход
app.get('/api/balance/:userId', async (req, res) => {
    const userId = String(req.params.userId);
    try {
        if (!db) return res.status(503).send("DB Busy");
        
        const now = Math.floor(Date.now() / 1000);
        let user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (user) {
            const offTime = Math.min(now - (user.last_active || now), 10800);
            const earned = (user.pnl / 3600) * offTime;
            
            res.json({ status: "ok", data: {
                score: user.balance + earned, 
                tap_power: user.click_lvl,
                pnl: user.pnl, 
                energy: user.energy, 
                level: user.level,
                max_energy: user.max_energy, 
                multiplier: 1
            }});
        } else {
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, 1000, 1, 0, 1000, 1000, 1, ?)`, [userId, now]);
            res.json({ status: "ok", data: { score: 1000, tap_power: 1, pnl: 0, energy: 1000, max_energy: 1000, level: 1, multiplier: 1 }});
        }
    } catch (e) { 
        res.status(500).json({ error: "Internal Error" }); 
    }
});

// 2. Улучшение клика (BOOST)
app.post('/api/upgrade/click', async (req, res) => {
    const { user_id } = req.body;
    try {
        const user = await db.get('SELECT balance, click_lvl FROM users WHERE id = ?', [String(user_id)]);
        if (!user) return res.json({ status: "error", message: "User not found" });

        const cost = Math.floor(500 * Math.pow(1.5, user.click_lvl - 1));

        if (user.balance >= cost) {
            const newBalance = user.balance - cost;
            const newLvl = user.click_lvl + 1;
            await db.run('UPDATE users SET balance = ?, click_lvl = ? WHERE id = ?', [newBalance, newLvl, String(user_id)]);
            res.json({ status: "ok", newBalance, newLvl });
        } else {
            res.json({ status: "error", message: "Недостаточно ресурсов" });
        }
    } catch (e) { res.status(500).send(e.message); }
});

// 3. Улучшение майнинга (MINE)
app.post('/api/upgrade/mine', async (req, res) => {
    const { user_id } = req.body;
    try {
        const user = await db.get('SELECT balance, pnl FROM users WHERE id = ?', [String(user_id)]);
        if (!user) return res.json({ status: "error", message: "User not found" });

        const currentMineLvl = Math.floor(user.pnl / 150);
        const cost = Math.floor(1000 * Math.pow(1.6, currentMineLvl));

        if (user.balance >= cost) {
            const newBalance = user.balance - cost;
            const newPnl = user.pnl + 150; 
            await db.run('UPDATE users SET balance = ?, pnl = ? WHERE id = ?', [newBalance, newPnl, String(user_id)]);
            res.json({ status: "ok", newBalance, newPnl });
        } else {
            res.json({ status: "error", message: "Недостаточно ресурсов" });
        }
    } catch (e) { res.status(500).send(e.message); }
});

// 4. Оптимизированное автосохранение
app.post('/api/save', async (req, res) => {
    try {
        const d = req.body;
        if (!d.user_id || d.user_id === "guest") return res.json({status: "ignored"});

        const now = Math.floor(Date.now() / 1000);
        
        // Валидация данных перед записью
        const balance = Number.isFinite(parseFloat(d.score)) ? parseFloat(d.score) : 0;
        const pnl = Number.isFinite(parseFloat(d.pnl)) ? parseFloat(d.pnl) : 0;

        await db.run(`UPDATE users SET balance=?, click_lvl=?, pnl=?, energy=?, level=?, last_active=? WHERE id=?`,
            [balance, parseInt(d.tap_power), pnl, parseFloat(d.energy), parseInt(d.level), now, String(d.user_id)]
        );
        res.json({status: "ok"});
    } catch (e) { res.status(500).send("Save Fail"); }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// --- [ЗАПУСК СЕРВЕРА] ---
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await initDB();
        await bot.telegram.deleteWebhook();
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Neural Pulse High-Load Node running on ${PORT}`);
        });

        bot.launch();
    } catch (err) {
        console.error("![CRITICAL] Startup Error:", err);
    }
}

startServer();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
