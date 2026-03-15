const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

// Данные из настроек твоего проекта
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Инициализация БД согласно правилам стабильности v2.1.5
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
        console.log("Database initialized (Stable v2.1.5 Core)");
    } catch (e) { 
        console.error("DB Error:", e); 
    }
};
initDB();

// Команда старта бота
bot.start((ctx) => {
    ctx.replyWithHTML(`<b>🚀 Neural Pulse System</b>`, Markup.inlineKeyboard([
        [Markup.button.webApp("Запустить Neural Pulse", "https://neural-pulse.bothost.ru")]
    ]));
});

// API: Получение данных пользователя
app.get('/api/user/:id', async (req, res) => {
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [req.params.id, req.query.name || 'Player']);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        res.json(r.rows[0]);
    } catch (e) { 
        res.status(500).send(e.message); 
    }
});

// API: Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, click_lvl, energy_lvl, speed_lvl, max_energy, energy, pnl } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, click_lvl=$3, energy_lvl=$4, speed_lvl=$5, max_energy=$6, energy=$7, pnl=$8 WHERE user_id=$1`,
            [userId, balance, click_lvl, energy_lvl, speed_lvl, max_energy, energy, pnl]
        );
        res.json({ok: true});
    } catch (e) { 
        res.status(500).send(e.message); 
    }
});

app.listen(3000, () => { 
    console.log("Server running on port 3000");
    bot.launch().catch(err => console.error("Bot launch fail:", err));
});
