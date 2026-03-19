const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: { rejectUnauthorized: false } }); // Рекомендую включить SSL для облачных БД

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

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
                wallet TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("✅ [DB] System Ready");
    } catch (e) { console.error("❌ [DB ERROR]", e.message); }
};
initDB();

// API: Получение/Создание пользователя
app.get('/api/user/:id', async (req, res) => {
    const userId = String(req.params.id);
    const username = req.query.username || 'Agent';
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [userId, username]);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        } else {
            await pool.query('UPDATE users SET username = $2, last_seen = NOW() WHERE user_id = $1', [userId, username]);
        }
        res.json(result.rows[0]);
    } catch (e) { 
        console.error("User API Error:", e.message);
        res.status(500).json({ error: "Database error" }); 
    }
});

// API: Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const d = req.body;
    if (!d.userId) return res.status(400).json({ error: "No UserID" });
    try {
        await pool.query(`UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, profit_hr=$6, lvl=$7 WHERE user_id=$1`, 
            [String(d.userId), d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: Сохранение кошелька
app.post('/api/wallet', async (req, res) => {
    const { userId, address } = req.body;
    try {
        await pool.query('UPDATE users SET wallet = $2 WHERE user_id = $1', [String(userId), address]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

bot.start(ctx => ctx.replyWithHTML(`<b>Neural Pulse</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]])));

app.listen(3000, () => console.log(`🚀 Server on 3000`));
bot.launch();
