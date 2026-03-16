const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const ADMIN_ID = 527506948; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Инициализация с проверкой структуры (v3.3.9)
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referrals (
                id SERIAL PRIMARY KEY,
                referrer_id TEXT REFERENCES users(user_id),
                referred_id TEXT UNIQUE REFERENCES users(user_id)
            )
        `);
        console.log("Database Sync: ONLINE (v3.3.9)");
    } catch (e) { console.error("DB Init Failure:", e); }
};
initDB();

// API: Глубокая проверка и получение пользователя
app.get('/api/user/:id', async (req, res) => {
    const uid = req.params.id;
    const { name, photo } = req.query;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        const vName = (!name || name === 'null' || name === 'undefined') ? 'Agent' : name;
        const vPhoto = (!photo || photo === 'null' || photo === 'undefined') ? '' : photo;

        if (!r.rows.length) {
            // Новый пользователь
            await pool.query('INSERT INTO users (user_id, username, avatar_url) VALUES ($1, $2, $3)', [uid, vName, vPhoto]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        } else {
            // Обновление метаданных (ник/аватар) без сброса игровых данных
            await pool.query('UPDATE users SET username=$1, avatar_url=$2 WHERE user_id=$3', [vName, vPhoto, uid]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: "Sync Fail" }); }
});

// API: Сохранение с гарантированной записью
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    try {
        await pool.query(`
            UPDATE users SET 
                balance=$2, energy=$3, max_energy=$4, click_lvl=$5, 
                wallet_addr=$6, has_bot=$7, last_seen=NOW() 
            WHERE user_id=$1
        `, [userId, parseFloat(balance) || 0, parseInt(energy) || 0, parseInt(max_energy) || 1000, parseInt(click_lvl) || 1, wallet, has_bot]);
        res.json({ ok: true });
    } catch (e) { res.status(500).send("Update Error"); }
});

// API: Список друзей
app.get('/api/friends/:id', async (req, res) => {
    const r = await pool.query('SELECT u.username FROM users u JOIN referrals r ON u.user_id = r.referred_id WHERE r.referrer_id = $1', [req.params.id]);
    res.json(r.rows);
});

// API: Таблица лидеров
app.get('/api/top', async (req, res) => {
    const r = await pool.query('SELECT user_id, username, avatar_url, balance FROM users WHERE username != \'null\' ORDER BY balance DESC LIMIT 100');
    res.json(r.rows);
});

// BOT LOGIC
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

    const mainBtn = [[Markup.button.webApp("SYNC & START", "https://neural-pulse.bothost.ru")]];
    if (ctx.from.id === ADMIN_ID) {
        mainBtn.push([Markup.button.callback("☢️ WIPE DATABASE", "wipe_confirm")]);
    }

    ctx.replyWithHTML(`<b>NEURAL PULSE v3.3.9</b>\n<i>Quantum Sync: Active</i>`, Markup.inlineKeyboard(mainBtn));
});

// Админка для тебя
bot.action("wipe_confirm", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("⚠️ ВНИМАНИЕ: Это удалит всех пользователей и рефералов. Подтверждаешь?", Markup.inlineKeyboard([
        [Markup.button.callback("✅ ОЧИСТИТЬ", "wipe_execute"), Markup.button.callback("❌ ОТМЕНА", "cancel")]
    ]));
});

bot.action("wipe_execute", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await pool.query('TRUNCATE users, referrals RESTART IDENTITY CASCADE');
    ctx.editMessageText("База данных обнулена.");
});

app.listen(3000, () => { console.log("v3.3.9 Node: Online"); bot.launch(); });
