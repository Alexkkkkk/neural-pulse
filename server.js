const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.2.9";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация БД
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0,
                last_bonus TIMESTAMP,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_bonus TIMESTAMP`);
        console.log(`v${VERSION} Database Connected`);
    } catch (err) { console.error("DB Error:", err); }
};
initDB();

// Математика: Доход в секунду + Бонус Лидера (+20%)
setInterval(async () => {
    try {
        const topUser = await pool.query('SELECT user_id FROM users ORDER BY balance DESC LIMIT 1');
        const leaderId = topUser.rows[0]?.user_id;

        await pool.query(`
            UPDATE users SET 
                energy = LEAST(1000, energy + 1),
                balance = balance + CASE 
                    WHEN user_id = $1 THEN (pnl * 1.2 / 3600) 
                    ELSE (pnl / 3600) 
                END
            WHERE last_active > NOW() - INTERVAL '24 hours'
        `, [leaderId]);
    } catch (e) {}
}, 1000);

// API
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    if (result.rows.length === 0) {
        await pool.query('INSERT INTO users (user_id) VALUES ($1)', [uid]);
        result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    }
    res.json(result.rows[0]);
});

app.get('/api/leaderboard', async (req, res) => {
    const result = await pool.query('SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT 10');
    res.json(result.rows);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    await pool.query(`
        UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5, last_active = CURRENT_TIMESTAMP
        WHERE user_id = $1
    `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl)]);
    res.json({ success: true });
});

app.post('/api/bonus', async (req, res) => {
    const uid = String(req.body.userId);
    const now = new Date();
    const user = await pool.query('SELECT last_bonus FROM users WHERE user_id = $1', [uid]);
    if (!user.rows[0]?.last_bonus || (now - new Date(user.rows[0].last_bonus)) > 86400000) {
        await pool.query('UPDATE users SET balance = balance + 5000, last_bonus = $2 WHERE user_id = $1', [uid, now]);
        return res.json({ success: true, amount: 5000 });
    }
    res.json({ success: false, msg: "Wait 24h" });
});

bot.start(ctx => ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}`)]])));
app.listen(PORT, () => { console.log(`Server v${VERSION} Live`); bot.launch(); });
