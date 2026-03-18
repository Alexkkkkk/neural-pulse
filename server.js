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

// Инициализация базы
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
        console.log("✅ [DB] База данных готова.");
    } catch (e) { console.error("❌ [DB ERROR]", e.message); }
};
initDB();

// Получение данных пользователя
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [userId, 'Agent']);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        let user = result.rows[0];
        // Превращаем строки из PG в числа для JS
        res.json({
            ...user,
            balance: parseFloat(user.balance) || 0,
            profit_hr: parseFloat(user.profit_hr) || 0,
            likes: parseInt(user.likes) || 0
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Сохранение данных
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, profit_hr, lvl, likes, is_liked } = req.body;
    try {
        await pool.query(`
            UPDATE users SET 
                balance = $2, energy = $3, max_energy = $4, 
                click_lvl = $5, profit_hr = $6, lvl = $7, 
                likes = $8, is_liked = $9,
                last_seen = CURRENT_TIMESTAMP WHERE user_id = $1`, 
            [userId, balance, energy, max_energy, click_lvl, profit_hr, lvl || 1, likes || 0, is_liked || false]
        );
        res.json({ ok: true });
    } catch (e) { 
        console.error("❌ Save error:", e.message);
        res.status(500).send(e.message); 
    }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v4.0.0</b>`, 
        Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { 
    console.log(`🚀 [SERVER] На порту 3000`);
    bot.launch();
});
