const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const ADMIN_ID = 476014374; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                avatar_url TEXT DEFAULT '', 
                balance NUMERIC DEFAULT 0, 
                energy INTEGER DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000, 
                click_lvl INTEGER DEFAULT 1, 
                pph NUMERIC DEFAULT 0,
                mine_lvls JSONB DEFAULT '{"cpu":0, "gpu":0, "asic":0}',
                wallet_addr TEXT, 
                has_bot BOOLEAN DEFAULT FALSE, 
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id TEXT REFERENCES users(user_id), referred_id TEXT UNIQUE REFERENCES users(user_id))`);
        console.log("v4.0.0 Payment & Mining Core Synced");
    } catch (e) { console.error(e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const { name, photo } = req.query;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        const validName = (!name || name === 'null' || name === 'undefined') ? 'Agent' : name;
        const validPhoto = (!photo || photo === 'null' || photo === 'undefined') ? '' : photo;

        if (!r.rows.length) {
            await pool.query('INSERT INTO users (user_id, username, avatar_url) VALUES ($1, $2, $3)', [req.params.id, validName, validPhoto]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        
        const user = r.rows[0];
        const now = new Date();
        const lastSeen = new Date(user.last_seen);
        const secondsOffline = Math.floor((now - lastSeen) / 1000);
        
        let offlineProfit = 0;
        if (user.pph > 0 && secondsOffline > 60) {
            const cappedSeconds = Math.min(secondsOffline, 10800); // макс 3 часа
            offlineProfit = (user.pph / 3600) * cappedSeconds;
            await pool.query('UPDATE users SET balance = balance + $1, last_seen = CURRENT_TIMESTAMP WHERE user_id = $2', [offlineProfit, user.user_id]);
        }
        res.json({ ...user, offline_profit: offlineProfit });
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot, pph, mine_lvls } = req.body;
    try {
        await pool.query(`
            UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, wallet_addr=$6, has_bot=$7, pph=$8, mine_lvls=$9, last_seen=CURRENT_TIMESTAMP 
            WHERE user_id=$1`, [userId, balance, energy, max_energy, click_lvl, wallet, has_bot, pph, JSON.stringify(mine_lvls)]);
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/top', async (req, res) => {
    const r = await pool.query("SELECT user_id, username, avatar_url, balance FROM users WHERE username IS NOT NULL ORDER BY balance DESC LIMIT 100");
    res.json(r.rows);
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v4.0.0</b>\n<i>Payment System: Online</i>`, 
    Markup.inlineKeyboard([[Markup.button.webApp("OPEN APP", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { console.log("v4.0.0 Active"); bot.launch(); });
