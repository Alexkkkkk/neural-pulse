const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const ADMIN_ID = 476014374; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Инициализация базы данных v3.8.2
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
                wallet_addr TEXT, 
                has_bot BOOLEAN DEFAULT FALSE, 
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id TEXT REFERENCES users(user_id), referred_id TEXT UNIQUE REFERENCES users(user_id))`);
        console.log("v3.8.2 Neural Database Synced");
    } catch (e) { console.error(e); }
};
initDB();

// API: Получение/Создание пользователя
app.get('/api/user/:id', async (req, res) => {
    const { name, photo } = req.query;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        const validName = (!name || name === 'null' || name === 'undefined') ? 'Agent' : name;
        const validPhoto = (!photo || photo === 'null' || photo === 'undefined') ? '' : photo;

        if (!r.rows.length) {
            await pool.query('INSERT INTO users (user_id, username, avatar_url) VALUES ($1, $2, $3)', [req.params.id, validName, validPhoto]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).send(e.message); }
});

// API: Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    try {
        await pool.query(`
            UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, wallet_addr=$6, has_bot=$7, last_seen=CURRENT_TIMESTAMP 
            WHERE user_id=$1`, [userId, balance, energy, max_energy, click_lvl, wallet, has_bot]);
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

// API: Друзья и Топ
app.get('/api/friends/:id', async (req, res) => {
    const r = await pool.query('SELECT u.username FROM users u JOIN referrals r ON u.user_id = r.referred_id WHERE r.referrer_id = $1', [req.params.id]);
    res.json(r.rows);
});

app.get('/api/top', async (req, res) => {
    const r = await pool.query("SELECT user_id, username, avatar_url, balance FROM users WHERE username IS NOT NULL ORDER BY balance DESC LIMIT 100");
    res.json(r.rows);
});

// Бот старт
bot.start(async (ctx) => {
    const refId = ctx.startPayload;
    const uid = ctx.from.id.toString();
    const kb = [[Markup.button.webApp("OPEN AGENT", "https://neural-pulse.bothost.ru")]];
    if (ctx.from.id === ADMIN_ID) kb.push([Markup.button.callback("🛠 ADMIN", "adm")]);
    ctx.replyWithHTML(`<b>Neural Mining v3.8.2</b>\n<i>Quantum Math Engine: Active</i>`, Markup.inlineKeyboard(kb));
});

app.listen(3000, () => { console.log("v3.8.2 Online"); bot.launch(); });
