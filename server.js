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

// ПРАВИЛО: Инициализация с защитой от ошибок типов
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
        // Проверка и добавление колонок по одной (защита от падения)
        const cols = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT ''",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_addr TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS has_bot BOOLEAN DEFAULT FALSE"
        ];
        for (let sql of cols) { await pool.query(sql).catch(() => {}); }
        console.log("DB Engine: READY (v3.1.9)");
    } catch (e) { console.error("DB INIT ERROR:", e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = req.params.id;
    const { name, photo } = req.query;
    try {
        const query = `
            INSERT INTO users (user_id, username, avatar_url)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE 
            SET username = EXCLUDED.username, avatar_url = EXCLUDED.avatar_url
            RETURNING *;
        `;
        const r = await pool.query(query, [uid, name || 'Agent', photo || '']);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: "Fetch Fail" }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    if (!userId || userId === "0") return res.status(400).send();

    try {
        // ПРАВИЛО: Используем COALESCE и явное приведение типов, чтобы обойти ошибки bigint/timestamp
        const saveQuery = `
            UPDATE users SET 
                balance = $2, 
                energy = $3, 
                max_energy = $4, 
                click_lvl = $5, 
                wallet_addr = $6, 
                has_bot = $7, 
                last_seen = NOW() 
            WHERE user_id = $1
        `;
        await pool.query(saveQuery, [
            userId, balance, energy, max_energy, click_lvl, wallet, has_bot
        ]);
        res.json({ success: true });
    } catch (e) { 
        console.error("SAVE ERROR:", e.message);
        res.status(500).json({ error: "Internal Save Error" }); 
    }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 20');
        res.json(r.rows);
    } catch (e) { res.json([]); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v3.1.9</b>\nСистема восстановлена.`,
        Markup.inlineKeyboard([[Markup.button.webApp("OPEN CLUSTER", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { console.log("Pulse Server v3.1.9 Live"); bot.launch(); });
