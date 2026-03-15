const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.6.9.1";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static'))); 

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
            friends_count INTEGER DEFAULT 0,
            has_bot BOOLEAN DEFAULT FALSE,
            last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log(`[ v${VERSION} ] System: Synced.`);
    } catch (e) { console.error("DB Error", e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        let r = await pool.query('SELECT *, EXTRACT(EPOCH FROM (NOW() - last_sync)) as seconds_off FROM users WHERE user_id = $1', [uid]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id) VALUES ($1)', [uid]);
            r = await pool.query('SELECT *, 0 as seconds_off FROM users WHERE user_id = $1', [uid]);
        }
        const user = r.rows[0];
        res.json({
            ...user,
            balance: Number(user.balance || 0),
            energy: Number(user.energy || 1000),
            max_energy: Number(user.max_energy || 1000),
            click_lvl: Number(user.click_lvl || 1),
            pnl: Number(user.pnl || 0),
            friends_count: Number(user.friends_count || 0),
            has_bot: user.has_bot || false
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, pnl, wallet, friends_count, has_bot } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, pnl=$6, wallet_address=$7, friends_count=$8, has_bot=$9, last_sync=NOW() WHERE user_id=$1`, 
            [String(userId), balance, energy, max_energy, click_lvl, pnl, wallet, friends_count, has_bot]
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
            await pool.query('INSERT INTO users (user_id, username, referrer_id) VALUES ($1, $2, $3)', [uid, ctx.from.first_name, refId || null]);
            if (refId && refId !== uid) {
                await pool.query('UPDATE users SET balance = balance + 5000, friends_count = friends_count + 1 WHERE user_id = $1', [refId]);
            }
        }
    } catch(e) {}
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://neural-pulse.bothost.ru`)]]));
});

app.listen(3000, () => { bot.launch(); });
