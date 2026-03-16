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
// Интеграция статики согласно твоей структуре
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
            wallet_addr TEXT
        )`);
    } catch (e) { console.error("DB Error:", e); }
};
initDB();

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v2.2.5</b>`, Markup.inlineKeyboard([
        [Markup.button.webApp("OPEN TERMINAL", "https://neural-pulse.bothost.ru")]
    ]));
});

app.get('/api/user/:id', async (req, res) => {
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [req.params.id, req.query.name || 'Agent']);
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
    const { userId, balance, energy, click_lvl, wallet } = req.body;
    try {
        await pool.query(
            'UPDATE users SET balance=$2, energy=$3, click_lvl=$4, wallet_addr=$5 WHERE user_id=$1', 
            [userId, balance, energy, click_lvl, wallet]
        );
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(3000, () => { bot.launch(); });
