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

// Инициализация базы данных v3.8.5
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
                has_bot BOOLEAN DEFAULT FALSE, 
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id TEXT REFERENCES users(user_id), referred_id TEXT UNIQUE REFERENCES users(user_id))`);
        console.log("v3.8.5 Quantum & Mining Engine Synced");
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
        } else if(r.rows[0].username !== validName || r.rows[0].avatar_url !== validPhoto) {
            await pool.query('UPDATE users SET username=$1, avatar_url=$2 WHERE user_id=$3', [validName, validPhoto, req.params.id]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).send(e.message); }
});

// API: Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, profit_hr, wallet, has_bot } = req.body;
    try {
        await pool.query(`
            UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, profit_hr=$6, wallet_addr=$7, has_bot=$8, last_seen=CURRENT_TIMESTAMP 
            WHERE user_id=$1`, [userId, balance, energy, max_energy, click_lvl, profit_hr, wallet, has_bot]);
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

// API: Друзья
app.get('/api/friends/:id', async (req, res) => {
    const r = await pool.query('SELECT u.username FROM users u JOIN referrals r ON u.user_id = r.referred_id WHERE r.referrer_id = $1', [req.params.id]);
    res.json(r.rows);
});

// API: Топ игроков
app.get('/api/top', async (req, res) => {
    const r = await pool.query("SELECT user_id, username, avatar_url, balance FROM users WHERE username IS NOT NULL AND username != 'null' ORDER BY balance DESC LIMIT 100");
    res.json(r.rows);
});

// Бот старт
bot.start(async (ctx) => {
    const refId = ctx.startPayload;
    const uid = ctx.from.id.toString();
    if (refId && refId !== uid) {
        const exists = await pool.query('SELECT * FROM referrals WHERE referred_id = $1', [uid]);
        if (!exists.rows.length) {
            await pool.query('INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)', [refId, uid]);
            await pool.query('UPDATE users SET balance = balance + 10000 WHERE user_id = $1', [refId]);
        }
    }
    const kb = [[Markup.button.webApp("OPEN APP", "https://neural-pulse.bothost.ru")]];
    if (ctx.from.id === ADMIN_ID) kb.push([Markup.button.callback("🛠 ADMIN PANEL", "adm")]);
    ctx.replyWithHTML(`<b>Neural Pulse v3.8.5</b>\n<i>Quantum Math & Mining Active</i>`, Markup.inlineKeyboard(kb));
});

// Админ-логика
bot.action("adm", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText("<b>Админ-панель:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🧨 СБРОС БАЗЫ", "wipe")],
            [Markup.button.callback("💰 GIVE 1M", "give_money")],
            [Markup.button.callback("❌ Закрыть", "cls")]
        ])
    });
});

bot.action("give_money", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await pool.query('UPDATE users SET balance = balance + 1000000 WHERE user_id = $1', [ADMIN_ID.toString()]);
    ctx.answerCbQuery("Начислено 1,000,000!");
});

bot.action("wipe", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await pool.query('TRUNCATE users, referrals RESTART IDENTITY CASCADE');
    ctx.editMessageText("✅ База данных очищена.");
});

bot.action("cls", (ctx) => ctx.deleteMessage());

app.listen(3000, () => { console.log("v3.8.5 Live"); bot.launch(); });
