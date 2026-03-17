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

// Таблица БД
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
                profit_hr NUMERIC DEFAULT 0,
                wallet_addr TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("Database Ready v3.8.8");
    } catch (e) { console.error("DB Error:", e); }
};
initDB();

// API Эндпоинты
app.get('/api/user/:id', async (req, res) => {
    const { name, photo } = req.query;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        if (!r.rows.length) {
            await pool.query('INSERT INTO users (user_id, username, avatar_url) VALUES ($1, $2, $3)', 
                [req.params.id, name || 'Agent', photo || '']);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, profit_hr } = req.body;
    try {
        await pool.query(`
            UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, profit_hr=$6, last_seen=CURRENT_TIMESTAMP 
            WHERE user_id=$1`, [userId, balance, energy, max_energy, click_lvl, profit_hr]);
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/save-wallet', async (req, res) => {
    const { userId, wallet } = req.body;
    try {
        await pool.query('UPDATE users SET wallet_addr=$2 WHERE user_id=$1', [userId, wallet]);
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/top', async (req, res) => {
    const r = await pool.query("SELECT username, balance FROM users ORDER BY balance DESC LIMIT 10");
    res.json(r.rows);
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v3.8.8</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp("OPEN APP", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { console.log("Server v3.8.8 started"); bot.launch(); });
