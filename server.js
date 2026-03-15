const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.9.6";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация таблицы с гарантированными значениями по умолчанию
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
            last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log(`[DB] Таблица проверена, версия ${VERSION}`);
    } catch (e) { console.error("DB Error:", e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const name = req.query.name || 'Neural Player';
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [uid, name]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        const u = r.rows[0];
        // СТРОГАЯ ПРОВЕРКА ТИПОВ ДЛЯ ИГРЫ
        res.json({
            user_id: u.user_id,
            username: u.username,
            balance: Number(u.balance) || 0,
            pnl: Number(u.pnl) || 0,
            energy: Number(u.energy) || 0,
            max_energy: Number(u.max_energy) || 1000,
            click_lvl: Number(u.click_lvl) || 1,
            wallet_address: u.wallet_address
        });
    } catch (e) { res.status(500).json({ error: "DB Read Fail" }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, username, balance, energy, max_energy, click_lvl, pnl, wallet } = req.body;
    try {
        // COALESCE гарантирует, что в БД не попадет NULL
        await pool.query(
            `UPDATE users SET 
                username = $2, 
                balance = $3, 
                energy = $4, 
                max_energy = $5, 
                click_lvl = $6, 
                pnl = $7, 
                wallet_address = $8, 
                last_sync = NOW() 
            WHERE user_id = $1`, 
            [String(userId), username, Number(balance) || 0, Number(energy) || 0, Number(max_energy) || 1000, Number(click_lvl) || 1, Number(pnl) || 0, wallet]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "DB Save Fail" }); }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT user_id, username, balance FROM users ORDER BY balance DESC LIMIT 10');
        res.json(r.rows);
    } catch (e) { res.status(500).json([]); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ START NODE', `https://neural-pulse.bothost.ru`)]]));
});

app.listen(3000, () => { console.log(`Server v${VERSION} Online`); bot.launch(); });
