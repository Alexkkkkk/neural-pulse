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

// Инициализация БД
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
        console.log("Build 2.5.3 - Node.js Backend & Design Locked");
    } catch (e) { console.error("DB Error:", e); }
};
initDB();

// API: Загрузка пользователя
app.get('/api/user/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [userId, req.query.name || 'Agent']);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).send(e.message); }
});

// API: Сохранение прогресса
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

// Telegram Bot
bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v2.5.3</b>\nNode.js Active Engine.`, Markup.inlineKeyboard([
        [Markup.button.webApp("OPEN TERMINAL", "https://neural-pulse.bothost.ru")]
    ]));
});

const PORT = 3000;
app.listen(PORT, () => { 
    console.log(`v2.5.3 | Port ${PORT} | Design & Sync Active`);
    bot.launch().catch(err => console.error("Telegram Bot Error:", err)); 
});
