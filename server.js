const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Инициализация БД с поддержкой аватарок и имен
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                photo_url TEXT DEFAULT 'logo.png',
                balance NUMERIC DEFAULT 0,  
                energy INTEGER DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                click_lvl INTEGER DEFAULT 1, 
                profit_hr NUMERIC DEFAULT 0,  
                lvl INTEGER DEFAULT 1,
                likes INTEGER DEFAULT 0,
                is_liked BOOLEAN DEFAULT FALSE,
                wallet TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("✅ [DB] Ready with Avatar support");
    } catch (e) { console.error("❌ [DB ERROR]", e.message); }
};
initDB();

// --- API: Получение данных пользователя ---
app.get('/api/user/:id', async (req, res) => {
    const userId = String(req.params.id);
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [userId, 'Agent']);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: ТОП 100 Игроков (с аватарами) ---
app.get('/api/top', async (req, res) => {
    try {
        // Выбираем 100 лучших по балансу
        const result = await pool.query(`
            SELECT user_id, username as name, photo_url, balance 
            FROM users 
            ORDER BY balance DESC 
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: Привязка кошелька ---
app.post('/api/wallet', async (req, res) => {
    const { userId, address } = req.body;
    try {
        await pool.query('UPDATE users SET wallet = $2 WHERE user_id = $1', [String(userId), address]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: Сохранение прогресса ---
app.post('/api/save', async (req, res) => {
    const d = req.body;
    if (!d.userId) return res.status(400).json({ error: "No userId" });
    try {
        await pool.query(`
            UPDATE users SET 
                balance = $2, energy = $3, max_energy = $4, 
                click_lvl = $5, profit_hr = $6, lvl = $7, 
                likes = $8, is_liked = $9, 
                username = $10, photo_url = $11,
                last_seen = CURRENT_TIMESTAMP 
            WHERE user_id = $1`, 
            [
                String(d.userId), d.balance, d.energy, d.max_energy, 
                d.click_lvl, d.profit_hr, d.lvl, d.likes || 0, d.is_liked || false,
                d.username || 'Agent', d.photo_url || 'logo.png'
            ]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Telegram Bot ---
bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v4.0.0</b>\nДобро пожаловать в нейросетевой майнинг!`, 
        Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]]));
});

// Запуск
app.listen(3000, () => {
    console.log(`🚀 Server running on port 3000`);
    bot.launch();
});
