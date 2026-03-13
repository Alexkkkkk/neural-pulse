const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

// Данные из ваших настроек
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static'))); // Папка static согласно вашим требованиям

// Инициализация БД
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0,
                last_seen BIGINT DEFAULT extract(epoch from now())
            );
        `);
    } catch (err) { console.error("DB Error:", err.message); }
};
initDB();

// API: Получение данных
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (result.rows.length === 0) {
            const newUser = await pool.query('INSERT INTO users (user_id) VALUES ($1) RETURNING *', [uid]);
            return res.json(newUser.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// API: Сохранение
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    try {
        await pool.query(`
            INSERT INTO users (user_id, balance, energy, click_lvl, pnl, last_seen)
            VALUES ($1, $2, $3, $4, $5, extract(epoch from now()))
            ON CONFLICT (user_id) DO UPDATE SET
            balance = EXCLUDED.balance, energy = EXCLUDED.energy,
            click_lvl = EXCLUDED.click_lvl, pnl = EXCLUDED.pnl, last_seen = EXCLUDED.last_seen
        `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl)]);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: "Save Fail" }); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE AI</b>\nСистема запущена.`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]]));
});

app.listen(PORT, () => {
    console.log(`Server: https://${DOMAIN}`);
    bot.launch();
});
