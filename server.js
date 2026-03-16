const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, username TEXT, balance NUMERIC DEFAULT 0, energy INTEGER DEFAULT 1000, max_energy INTEGER DEFAULT 1000, click_lvl INTEGER DEFAULT 1, wallet_addr TEXT, has_bot BOOLEAN DEFAULT FALSE, last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id TEXT REFERENCES users(user_id), referred_id TEXT UNIQUE REFERENCES users(user_id))`);
        console.log("v2.9.0 Ready");
    } catch (e) { console.error(e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        if (!r.rows.length) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [req.params.id, req.query.name || 'Agent']);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/friends/:id', async (req, res) => {
    try {
        const r = await pool.query('SELECT u.username FROM users u JOIN referrals r ON u.user_id = r.referred_id WHERE r.referrer_id = $1', [req.params.id]);
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT user_id, username, balance FROM users ORDER BY balance DESC LIMIT 100');
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    try {
        await pool.query('UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, wallet_addr=$6, has_bot=$7, last_seen=CURRENT_TIMESTAMP WHERE user_id=$1', [userId, balance, energy, max_energy, click_lvl, wallet, has_bot]);
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

bot.start(async (ctx) => {
    const refId = ctx.startPayload;
    const uid = ctx.from.id.toString();
    if (refId && refId !== uid) {
        const exists = await pool.query('SELECT * FROM referrals WHERE referred_id = $1', [uid]);
        if (!exists.rows.length) {
            await pool.query('INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)', [refId, uid]);
            await pool.query('UPDATE users SET balance = balance + 5000 WHERE user_id = $1', [refId]);
        }
    }
    ctx.replyWithHTML(`<b>Neural Pulse v2.9.0</b>`, Markup.inlineKeyboard([[Markup.button.webApp("OPEN APP", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { console.log("v2.9.0 Active"); bot.launch(); });
