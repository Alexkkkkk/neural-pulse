const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

// Конфигурация
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const pool = new Pool({ 
    connectionString: PG_URI,
    ssl: false 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Инициализация базы данных
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                balance NUMERIC DEFAULT 0,  
                energy INTEGER DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                click_lvl INTEGER DEFAULT 1, 
                profit_hr NUMERIC DEFAULT 0,  
                lvl INTEGER DEFAULT 1,
                likes INTEGER DEFAULT 0,
                is_liked BOOLEAN DEFAULT FALSE,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("✅ [DB] База данных проверена и готова.");
    } catch (e) { 
        console.error("❌ [DB INIT ERROR]", e.message); 
    }
};
initDB();

// API: Получение Топ-100 игроков
app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT username, balance, lvl 
            FROM users 
            ORDER BY balance DESC 
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (e) {
        console.error("❌ [TOP ERROR]", e.message);
        res.status(500).json({ error: e.message });
    }
});

// API: Получение данных пользователя + Офлайн доход
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [userId, 'Agent']);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        let user = result.rows[0];
        if (user.profit_hr > 0) {
            const now = new Date();
            const lastSeen = new Date(user.last_seen);
            const secondsOffline = Math.floor((now - lastSeen) / 1000);
            if (secondsOffline > 60) {
                const offlineProfit = (user.profit_hr / 3600) * secondsOffline;
                user.balance = parseFloat(user.balance) + offlineProfit;
                await pool.query('UPDATE users SET balance = $1, last_seen = CURRENT_TIMESTAMP WHERE user_id = $2', [user.balance, userId]);
            }
        }
        res.json(user);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// API: Сохранение данных
app.post('/api/save', async (req, res) => {
    const d = req.body;
    try {
        await pool.query(`
            UPDATE users SET 
                balance = $2, energy = $3, max_energy = $4, 
                click_lvl = $5, profit_hr = $6, lvl = $7, 
                likes = $8, is_liked = $9,
                last_seen = CURRENT_TIMESTAMP 
            WHERE user_id = $1`, 
            [d.userId, d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl, d.likes || 0, d.is_liked || false]
        );
        res.json({ ok: true });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v4.0.0</b>`, 
        Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]]));
});

const PORT = 3000;
app.listen(PORT, () => { 
    console.log(`🚀 [SERVER] Запущен на порту ${PORT}`);
    bot.launch().catch(err => console.error("Бот не запустился:", err));
});
