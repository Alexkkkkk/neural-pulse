const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.3.0";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0,
                referred_by TEXT,
                last_bonus TIMESTAMP,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log(`v${VERSION} Engine Ready`);
    } catch (err) { console.error("DB Error:", err); }
};
initDB();

app.get('/api/stats', async (req, res) => {
    try {
        const u = await pool.query('SELECT COUNT(*) FROM users');
        const b = await pool.query('SELECT SUM(balance) FROM users');
        res.json({ users: u.rows[0].count, circulating: Math.floor(b.rows[0].sum || 0) });
    } catch (e) { res.status(500).send(); }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, balance, pnl FROM users ORDER BY balance DESC LIMIT 15');
        res.json(result.rows);
    } catch (e) { res.status(500).send(); }
});

setInterval(async () => {
    try {
        await pool.query(`UPDATE users SET energy = LEAST(1000, energy + 1), balance = balance + (pnl / 3600) WHERE last_active > NOW() - INTERVAL '24 hours'`);
    } catch (e) {}
}, 1000);

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
    await pool.query(`UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5, last_active = CURRENT_TIMESTAMP WHERE user_id = $1`, 
    [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl)]);
    res.json({ status: 'ok' });
});

app.post('/api/bonus', async (req, res) => {
    const uid = String(req.body.userId);
    const now = new Date();
    const user = await pool.query('SELECT last_bonus FROM users WHERE user_id = $1', [uid]);
    if (!user.rows[0]?.last_bonus || (now - new Date(user.rows[0].last_bonus)) > 86400000) {
        await pool.query('UPDATE users SET balance = balance + 5000, last_bonus = $2 WHERE user_id = $1', [uid, now]);
        return res.json({ success: true, amount: 5000 });
    }
    res.json({ success: false, msg: "Try again in 24h" });
});

bot.start(ctx => ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}`)]])));
app.listen(PORT, () => { console.log(`v${VERSION} Online`); bot.launch(); });
