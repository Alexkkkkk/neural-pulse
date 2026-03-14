// v1.5.2 - Обязательное логирование версии для Buthost
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.5.2";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
            rank TEXT DEFAULT 'Bronze Node',
            wallet_address TEXT
        )`);
    } catch (err) { console.error("DB Error:", err); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    if (r.rows.length === 0) {
        await pool.query('INSERT INTO users (user_id) VALUES ($1)', [uid]);
        r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    }
    res.json(r.rows[0]);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl, wallet } = req.body;
    await pool.query(`UPDATE users SET balance=$2, energy=$3, click_lvl=$4, pnl=$5, wallet_address=$6 WHERE user_id=$1`, 
    [String(userId), balance, energy, click_lvl, pnl, wallet]);
    res.json({ ok: true });
});

app.get('/api/stats', async (req, res) => {
    const r = await pool.query("SELECT username, balance FROM users ORDER BY balance DESC LIMIT 10");
    res.json(r.rows);
});

bot.start(c => c.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}`)]])));

app.listen(3000, () => {
    // ВЫВОД В ЛОГ БУТХОСТА (Согласно v1.5.2)
    console.log("========================================");
    console.log(`SERVER STARTED SUCCESSFULLY`);
    console.log(`CURRENT PROJECT VERSION: ${VERSION}`);
    console.log(`DOMAIN: ${DOMAIN}`);
    console.log("========================================");
    bot.launch();
});
