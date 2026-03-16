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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT DEFAULT 'Agent',
                avatar_url TEXT DEFAULT '',
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                max_energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                wallet_addr TEXT,
                has_bot BOOLEAN DEFAULT FALSE,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Database v3.0.1 Quantum Active");
    } catch (e) { console.error(e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const { name, photo } = req.query;
    const uid = req.params.id;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        const validName = (name && name !== 'null') ? name : 'Agent';
        const validPhoto = (photo && photo !== 'null') ? photo : '';

        if (!r.rows.length) {
            await pool.query('INSERT INTO users (user_id, username, avatar_url) VALUES ($1, $2, $3)', [uid, validName, validPhoto]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        } else {
            await pool.query('UPDATE users SET username=$1, avatar_url=$2 WHERE user_id=$3', [validName, validPhoto, uid]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance = GREATEST(balance, $2), energy = $3, max_energy = $4, click_lvl = $5, wallet_addr = $6, has_bot = $7, last_seen = CURRENT_TIMESTAMP WHERE user_id = $1`,
            [userId, balance, energy, max_energy, click_lvl, wallet, has_bot]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT user_id, username, avatar_url, balance FROM users WHERE user_id != \'0\' ORDER BY balance DESC LIMIT 100');
        res.json(r.rows);
    } catch (e) { res.status(500).json({error: e.message}); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(
        `<b>Neural Pulse v3.0.1</b>\nСистема синхронизирована.`,
        Markup.inlineKeyboard([[Markup.button.webApp("ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]])
    );
});

app.listen(3000, () => {
    console.log("Server running v3.0.1");
    bot.launch();
});
