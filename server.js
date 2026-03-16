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
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, 
            username TEXT,
            balance NUMERIC DEFAULT 0,
            energy INTEGER DEFAULT 1000,
            max_energy INTEGER DEFAULT 1000,
            click_lvl INTEGER DEFAULT 1,
            energy_lvl INTEGER DEFAULT 1,
            speed_lvl INTEGER DEFAULT 1,
            pnl NUMERIC DEFAULT 0
        )`);
    } catch (e) { console.error("Database Error:", e); }
};
initDB();

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v1.5.6</b>`, Markup.inlineKeyboard([
        [Markup.button.webApp("OPEN TERMINAL", "https://neural-pulse.bothost.ru")]
    ]));
});

app.get('/api/user/:id', async (req, res) => {
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [req.params.id, req.query.name || 'User']);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/stats', async (req, res) => {
    try {
        const r = await pool.query('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 10');
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, click_lvl, energy, max_energy } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, click_lvl=$3, energy=$4, max_energy=$5 WHERE user_id=$1`,
            [userId, balance, click_lvl, energy, max_energy]
        );
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(3000, () => { 
    console.log("Server v1.5.6 Online");
    bot.launch();
});
