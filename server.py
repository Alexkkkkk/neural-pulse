const express = require('express');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors'); // Добавили CORS для избежания проблем с WebApp

const app = express();
app.use(cors());
app.use(express.json());

// Исправленный путь к статике (теперь ищет index.html в папке static)
app.use('/static', express.static(path.join(__dirname, 'static')));

const API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM";
const bot = new Telegraf(API_TOKEN);
const WEB_APP_URL = "https://np.bothost.ru";

let db;
let userCache = new Map();

// --- [ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    db = await open({
        filename: path.join(__dirname, 'data', 'game.db'),
        driver: sqlite3.Database
    });
    // Добавлен AUTOINCREMENT или правильный порядок полей
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, 
        balance REAL, 
        click_lvl INTEGER, 
        pnl REAL DEFAULT 0, 
        energy REAL, 
        max_energy INTEGER, 
        level INTEGER DEFAULT 1, 
        last_active INTEGER)`);
    console.log("💾 SQLite Ready");
}

// --- [ЛОГИКА БОТА] ---
bot.start((ctx) => {
    const uid = ctx.from.id;
    ctx.replyWithHTML("🦾 <b>Neural Pulse: Протокол Запущен</b>", 
        Markup.inlineKeyboard([
            [Markup.button.webApp("ВХОД В НЕЙРОСЕТЬ 🧠", `${WEB_APP_URL}/?u=${uid}`)],
            [Markup.button.url("СООБЩЕСТВО 👥", "https://t.me/neural_pulse")]
        ])
    );
});

// --- [API ЭНДПОИНТЫ] ---
app.get('/api/balance/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const now = Math.floor(Date.now() / 1000);
        let user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            user = { id: userId, balance: 1000, click_lvl: 1, pnl: 0, energy: 1000, max_energy: 1000, level: 1, last_active: now };
            // Явно указываем поля для INSERT, чтобы избежать ошибок структуры
            await db.run('INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) VALUES (?,?,?,?,?,?,?,?)', 
                [user.id, user.balance, user.click_lvl, user.pnl, user.energy, user.max_energy, user.level, user.last_active]);
        }

        const offTime = Math.min(now - (user.last_active || now), 10800);
        const earned = (user.pnl / 3600) * offTime;

        res.json({ status: "ok", data: {
            score: user.balance + earned, tap_power: user.click_lvl,
            pnl: user.pnl, energy: user.energy, level: user.level,
            max_energy: user.max_energy
        }});
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

app.post('/api/save', (req, res) => {
    const data = req.body;
    if (data.user_id && data.user_id !== "guest") {
        userCache.set(String(data.user_id), data); // Приводим ID к строке
    }
    res.json({ status: "ok" });
});

// Главная страница игры
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'static', 'index.html')));

// --- [СИНХРОНИЗАЦИЯ] ---
setInterval(async () => {
    if (userCache.size === 0) return;
    const now = Math.floor(Date.now() / 1000);
    const usersToSync = Array.from(userCache.entries());
    userCache.clear(); // Очищаем сразу, чтобы новые тапы не потерялись

    for (let [uid, d] of usersToSync) {
        try {
            await db.run(`UPDATE users SET balance=?, click_lvl=?, pnl=?, energy=?, level=?, last_active=? WHERE id=?`,
                [d.score, d.tap_power, d.pnl, d.energy, d.level, now, uid]);
        } catch (err) {
            console.error(`❌ Sync error for ${uid}:`, err.message);
        }
    }
    console.log(`💾 Synced ${usersToSync.length} users`);
}, 15000);

// --- [ЗАПУСК] ---
const PORT = process.env.PORT || 3000; // Bothost может передавать порт через env
initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on port ${PORT}`));
    bot.launch().catch(err => console.error("Бот не запустился:", err));
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
