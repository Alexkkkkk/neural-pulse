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
        // Обновляем структуру таблицы users, добавляя поле avatar_url
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                avatar_url TEXT DEFAULT '', -- Новое поле для аватарок
                balance NUMERIC DEFAULT 0, 
                energy INTEGER DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000, 
                click_lvl INTEGER DEFAULT 1, 
                wallet_addr TEXT, 
                has_bot BOOLEAN DEFAULT FALSE, 
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id TEXT REFERENCES users(user_id), referred_id TEXT UNIQUE REFERENCES users(user_id))`);
        console.log("v2.9.8 Quantum Ready");
    } catch (e) { console.error(e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const { name, photo } = req.query; // Получаем имя и фото из запроса
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        
        // Математика исправления 'null': если имени нет (оно null в базе или в запросе), подставляем 'Agent'
        const validatedName = (!name || name === 'null') ? 'Agent' : name;
        // Валидация фото: если пришел URL, используем, иначе пустая строка (будет лого в ТОПе)
        const validatedPhoto = (!photo || photo === 'null' || photo === 'undefined') ? '' : photo;

        if (!r.rows.length) {
            // При создании нового пользователя сохраняем и URL аватарки
            await pool.query('INSERT INTO users (user_id, username, avatar_url) VALUES ($1, $2, $3)', [req.params.id, validatedName, validatedPhoto]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        } else {
            // Если пользователь уже есть, обновляем его имя и фото на случай, если он их сменил в ТГ
            if((r.rows[0].username !== validatedName && validatedName !== 'Agent') || r.rows[0].avatar_url !== validatedPhoto) {
                await pool.query('UPDATE users SET username=$1, avatar_url=$2 WHERE user_id=$3', [validatedName, validatedPhoto, req.params.id]);
                r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
            }
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/friends/:id', async (req, res) => {
    try {
        const r = await pool.query('SELECT u.username FROM users u JOIN referrals r ON u.user_id = r.referred_id WHERE r.referrer_id = $1', [req.params.id]);
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/top', async (req, res) => {
    try {
        // Получаемuser_id, username, avatar_url, balance
        const r = await pool.query('SELECT user_id, username, avatar_url, balance FROM users WHERE username IS NOT NULL AND username != \'null\' ORDER BY balance DESC LIMIT 100');
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    try {
        await pool.query('UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, wallet_addr=$6, has_bot=$7, last_seen=CURRENT_TIMESTAMP WHERE user_id=$1', [userId, balance, energy, max_energy, click_lvl, wallet, has_bot]);
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

bot.start(async (ctx) => {
    const refId = ctx.startPayload;
    const uid = ctx.from.id.toString();
    if (refId && refId !== uid) {
        const exists = await pool.query('SELECT * FROM referrals WHERE referred_id = $1', [uid]);
        if (!exists.rows.length) {
            await pool.query('INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)', [refId, uid]);
            await pool.query('UPDATE users SET balance = balance + 5000 WHERE user_id = $1', [refId]);
        }
    }
    ctx.replyWithHTML(`<b>Neural Pulse v2.9.8</b>`, Markup.inlineKeyboard([[Markup.button.webApp("OPEN APP", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { console.log("v2.9.8 Active"); bot.launch(); });
