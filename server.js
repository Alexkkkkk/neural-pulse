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
        // Создание базовой таблицы
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, 
            username TEXT,
            balance NUMERIC DEFAULT 0,
            energy INTEGER DEFAULT 1000,
            max_energy INTEGER DEFAULT 1000,
            click_lvl INTEGER DEFAULT 1,
            pnl NUMERIC DEFAULT 0,
            wallet_address TEXT
        )`);

        // Прямое добавление недостающих колонок (фикс ошибки 42703)
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_lvl INTEGER DEFAULT 1`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS speed_lvl INTEGER DEFAULT 1`);
        
        console.log("DB Structure v2.1.9: OK");
    } catch (e) {
        console.error("Critical DB Init Error:", e);
    }
};
initDB();

bot.start(async (ctx) => {
    const refId = ctx.startPayload;
    if (refId && refId !== String(ctx.from.id)) {
        await pool.query('UPDATE users SET balance = balance + 20000 WHERE user_id = $1', [refId]);
    }
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v2.1.9</b>`, Markup.inlineKeyboard([
        [Markup.button.webApp("⚡ START SYSTEM", "https://neural-pulse.bothost.ru")]
    ]));
});

// API для получения данных
app.get('/api/user/:id', async (req, res) => {
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [req.params.id, req.query.name || 'Player']);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({error: e.message}); }
});

// API для сохранения (включая новые параметры прокачки)
app.post('/api/save', async (req, res) => {
    const { userId, balance, click_lvl, energy_lvl, speed_lvl, max_energy, energy, pnl, wallet } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, click_lvl=$3, energy_lvl=$4, speed_lvl=$5, max_energy=$6, energy=$7, pnl=$8, wallet_address=$9 WHERE user_id=$1`,
            [userId, balance, click_lvl, energy_lvl, speed_lvl, max_energy, energy, pnl, wallet]
        );
        res.json({ok:true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.listen(3000, () => { 
    console.log("Server v2.1.9 Online"); 
    bot.launch().catch(err => console.error("Bot launch fail:", err)); 
});
