// Версия 1.4.6
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
// Статика строго в /public
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
            rank TEXT DEFAULT 'Bronze Node'
        )`);
        console.log("Database v1.4.6 Initialized");
    } catch (err) { console.error(err); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    try {
        const uid = String(req.params.id);
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id) VALUES ($1)', [uid]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    try {
        const { userId, username, balance, energy, max_energy, click_lvl, pnl, rank } = req.body;
        await pool.query(`
            UPDATE users SET username=$2, balance=$3, energy=$4, max_energy=$5, click_lvl=$6, pnl=$7, rank=$8
            WHERE user_id=$1
        `, [String(userId), username, Number(balance), Math.floor(energy), Math.floor(max_energy), Math.floor(click_lvl), Number(pnl), rank]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats', async (req, res) => {
    try {
        const r = await pool.query("SELECT username, balance FROM users ORDER BY balance DESC LIMIT 15");
        res.json(r.rows);
    } catch (e) { res.status(500).json([]); }
});

bot.start(c => c.replyWithHTML(`<b>🚀 NEURAL PULSE v1.4.6</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}`)]])));
app.listen(PORT, () => { console.log(`v1.4.6 Live on ${PORT}`); bot.launch(); });
