const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.1.8";
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
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Force update columns for older DB versions
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pnl NUMERIC DEFAULT 0`);
        console.log(`v${VERSION} Running. DB Sync OK.`);
    } catch (err) { console.error("DB Error:", err.message); }
};
initDB();

// Passive income & Energy regen math
setInterval(async () => {
    try {
        await pool.query(`
            UPDATE users 
            SET energy = LEAST(1000, energy + 1),
                balance = balance + (pnl / 3600)
            WHERE last_active > NOW() - INTERVAL '24 hours'
        `);
    } catch (e) {}
}, 1000);

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const refBy = req.query.refBy;
    let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    if (result.rows.length === 0) {
        await pool.query('INSERT INTO users (user_id, referred_by) VALUES ($1, $2)', [uid, refBy]);
        result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    }
    res.json(result.rows[0]);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    await pool.query(`
        UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5, last_active = CURRENT_TIMESTAMP
        WHERE user_id = $1
    `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl)]);
    res.json({ status: 'ok' });
});

app.post('/api/upgrade/click', async (req, res) => {
    const { userId, cost } = req.body;
    await pool.query('UPDATE users SET balance = balance - $2, click_lvl = click_lvl + 1 WHERE user_id = $1', [String(userId), cost]);
    res.json({ success: true });
});

bot.start(ctx => ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}`)]])));
app.listen(PORT, () => { console.log(`v${VERSION} Online`); bot.launch(); });
