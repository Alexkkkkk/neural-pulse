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

// Инициализация БД с поддержкой рефералов
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
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT 'logo.png'");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_id TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_count INTEGER DEFAULT 0");

        console.log("✅ [DB] Structure updated with Referral system");
    } catch (e) { console.error("❌ [DB ERROR]", e.message); }
};
initDB();

// API: Получение данных игрока
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

// API: Сохранение кошелька
app.post('/api/wallet', async (req, res) => {
    const { userId, address } = req.body;
    try {
        await pool.query('UPDATE users SET wallet = $2 WHERE user_id = $1', [String(userId), address]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: Лидерборд
app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, username as name, photo_url, balance FROM users ORDER BY balance DESC LIMIT 100');
        res.json(result.rows || []);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const d = req.body;
    try {
        await pool.query(`
            UPDATE users SET balance = $2, energy = $3, max_energy = $4, 
            click_lvl = $5, profit_hr = $6, lvl = $7, username = $8, photo_url = $9 
            WHERE user_id = $1`, 
            [String(d.userId), d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl, d.username, d.photo_url]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Бот с реферальной ссылкой
bot.start(async (ctx) => {
    const startPayload = ctx.startPayload; // ID пригласившего
    const userId = String(ctx.from.id);

    if (startPayload && startPayload !== userId) {
        const check = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (check.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username, referrer_id, balance) VALUES ($1, $2, $3, $4)', 
                [userId, ctx.from.first_name, startPayload, 5000]); // Даем 5000 за вход по ссылке
            await pool.query('UPDATE users SET balance = balance + 10000, ref_count = ref_count + 1 WHERE user_id = $1', [startPayload]);
        }
    }

    ctx.replyWithHTML(`<b>Neural Pulse</b>\nТвоя ссылка: <code>https://t.me/${ctx.botInfo.username}?start=${userId}</code>`, 
        Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => console.log(`🚀 Server on port 3000`));
bot.launch();
