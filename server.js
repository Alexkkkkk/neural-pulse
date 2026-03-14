const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.3.7";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
// ПУТЬ СТРОГО В STATIC СОГЛАСНО ПРАВИЛАМ
app.use(express.static(path.join(__dirname, 'static')));

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("PostgreSQL Initialized");
    } catch (e) { console.error("DB Error:", e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    if (r.rows.length === 0) {
        await pool.query('INSERT INTO users (user_id) VALUES ($1)', [uid]);
        r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    }
    res.json(r.rows[0]);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    await pool.query(`
        UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5, last_active = CURRENT_TIMESTAMP 
        WHERE user_id = $1`, 
    [String(userId), balance, energy, click_lvl, pnl]);
    res.json({ status: 'ok' });
});

app.get('/api/leaderboard', async (req, res) => {
    const r = await pool.query('SELECT user_id, balance, pnl FROM users ORDER BY balance DESC LIMIT 15');
    res.json(r.rows);
});

app.get('/api/stats', async (req, res) => {
    const r = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ users: r.rows[0].count });
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>\nCore is stable. Design locked.`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}`)]]));
});

app.listen(PORT, () => {
    bot.launch();
    console.log(`Server v${VERSION} running on port ${PORT}`);
});
