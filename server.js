const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// ГЛУБОКАЯ ИНИЦИАЛИЗАЦИЯ И СИНХРОНИЗАЦИЯ БАЗЫ
const initDB = async () => {
    try {
        // Базовая таблица
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
        
        await pool.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id TEXT, referred_id TEXT UNIQUE)`);

        // АВТО-МИГРАЦИЯ: Добавляем колонки, если их нет
        const columns = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_addr TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS has_bot BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ];
        for (let sql of columns) { await pool.query(sql).catch(() => {}); }
        
        console.log("System v3.3.1: Database Engine Synchronized");
    } catch (e) { console.error("DB INIT ERROR:", e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = req.params.id;
    const { name, photo } = req.query;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        const vName = (name === 'null' || !name || name === 'undefined') ? 'Agent' : name;
        const vPhoto = (photo === 'null' || !photo || photo === 'undefined') ? '' : photo;

        if (!r.rows.length) {
            await pool.query('INSERT INTO users (user_id, username, avatar_url) VALUES ($1, $2, $3)', [uid, vName, vPhoto]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        } else {
            await pool.query('UPDATE users SET avatar_url=$1, last_seen=NOW() WHERE user_id=$2', [vPhoto, uid]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    try {
        await pool.query(`
            UPDATE users SET 
                balance=$2, energy=$3, max_energy=$4, click_lvl=$5, 
                wallet_addr=$6, has_bot=$7, last_seen=NOW() 
            WHERE user_id=$1
        `, [userId, balance, energy, max_energy, click_lvl, wallet, has_bot]);
        res.json({ ok: true });
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT username, avatar_url, balance, user_id FROM users ORDER BY balance DESC LIMIT 50');
        res.json(r.rows);
    } catch (e) { res.json([]); }
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
    ctx.replyWithHTML(`<b>Neural Pulse v3.3.1</b>`, 
        Markup.inlineKeyboard([[Markup.button.webApp("OPEN CLUSTER", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { console.log("v3.3.1 Live on Port 3000"); bot.launch(); });
