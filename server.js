// Version: 1.3.1
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.3.1";
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
                card_plus_lvl INTEGER DEFAULT 0,
                card_mult_lvl INTEGER DEFAULT 0,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                offline_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log(`v${VERSION} Database Synced`);
    } catch (err) { console.error("DB Init Error:", err); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    if (result.rows.length === 0) {
        await pool.query('INSERT INTO users (user_id) VALUES ($1)', [uid]);
        result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    }
    let user = result.rows[0];
    // Расчет оффлайн дохода
    const now = new Date();
    const diff = (now - new Date(user.offline_sync)) / 1000 / 3600;
    if (diff > 0 && user.pnl > 0) {
        const reward = user.pnl * Math.min(diff, 3);
        user.balance = Number(user.balance) + reward;
        await pool.query('UPDATE users SET balance = $1, offline_sync = CURRENT_TIMESTAMP WHERE user_id = $2', [user.balance, uid]);
    }
    res.json(user);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl, card_plus_lvl, card_mult_lvl } = req.body;
    await pool.query(`
        UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5, 
        card_plus_lvl = $6, card_mult_lvl = $7, last_active = CURRENT_TIMESTAMP, offline_sync = CURRENT_TIMESTAMP
        WHERE user_id = $1
    `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl), card_plus_lvl || 0, card_mult_lvl || 0]);
    res.json({ status: 'ok' });
});

app.get('/api/stats', async (req, res) => {
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    const totalBalance = await pool.query('SELECT SUM(balance) FROM users');
    res.json({ users: totalUsers.rows[0].count, circulating: Math.floor(totalBalance.rows[0].sum || 0) });
});

app.get('/api/leaderboard', async (req, res) => {
    const result = await pool.query('SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT 10');
    res.json(result.rows);
});

bot.start(ctx => ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}`)]])));

app.listen(PORT, () => { 
    console.log(`Server v${VERSION} Online`); 
    bot.launch(); 
});
