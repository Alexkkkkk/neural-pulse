const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.6.6";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 

const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, 
            username TEXT DEFAULT 'Neural Player',
            balance NUMERIC DEFAULT 0,
            energy INTEGER DEFAULT 1000,
            max_energy INTEGER DEFAULT 1000,
            click_lvl INTEGER DEFAULT 1,
            pnl NUMERIC DEFAULT 0,
            wallet_address TEXT DEFAULT NULL,
            referrer_id TEXT DEFAULT NULL,
            friends_count INTEGER DEFAULT 0
        )`);
        console.log(`[ v${VERSION} ] DB verified.`);
    } catch (e) { console.error("DB Error", e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id) VALUES ($1)', [uid]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl, wallet, friends_count } = req.body;
    if (!userId || userId === '0') return res.status(400).end();
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, click_lvl=$4, pnl=$5, wallet_address=$6, friends_count=$7 WHERE user_id=$1`, 
            [String(userId), balance, energy, click_lvl, pnl, wallet, friends_count || 0]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const refId = ctx.startPayload;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username, referrer_id) VALUES ($1, $2, $3)', 
            [uid, ctx.from.first_name, refId || null]);
            if (refId) {
                await pool.query('UPDATE users SET balance = balance + 5000, friends_count = friends_count + 1 WHERE user_id = $1', [refId]);
            }
        }
    } catch(e) {}
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://neural-pulse.bothost.ru`)]]));
});

app.listen(3000, () => {
    console.log(`[ v${VERSION} ] SERVER RUNNING.`);
    bot.launch();
});
