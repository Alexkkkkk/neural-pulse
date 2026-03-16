const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: { rejectUnauthorized: false } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Глубокая проверка и инициализация таблиц
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
        console.log("Database Engine: FULL SYNC ACTIVE");
    } catch (e) { console.error("FATAL DB ERROR:", e); }
};
initDB();

// API получения данных
app.get('/api/user/:id', async (req, res) => {
    const uid = req.params.id;
    const { name, photo } = req.query;
    try {
        // Используем UPSERT (INSERT OR UPDATE) сразу при входе, чтобы гарантировать наличие записи
        const query = `
            INSERT INTO users (user_id, username, avatar_url)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE 
            SET username = EXCLUDED.username, avatar_url = EXCLUDED.avatar_url
            RETURNING *;
        `;
        const vName = (name && name !== 'null') ? name : 'Agent';
        const vPhoto = (photo && photo !== 'null') ? photo : '';
        
        const r = await pool.query(query, [uid, vName, vPhoto]);
        res.json(r.rows[0]);
    } catch (e) { 
        console.error("Fetch Error:", e);
        res.status(500).json({ error: "DB Fetch Failed" }); 
    }
});

// API сохранения — КРИТИЧЕСКИЙ УЗЕЛ
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    
    if (!userId || userId === "0") return res.status(400).json({ error: "Invalid ID" });

    try {
        // Принудительное приведение к типам данных базы (NUMERIC и INT)
        const saveQuery = `
            UPDATE users SET 
                balance = GREATEST(balance, $2::NUMERIC), 
                energy = $3::INTEGER, 
                max_energy = $4::INTEGER, 
                click_lvl = $5::INTEGER, 
                wallet_addr = $6, 
                has_bot = $7, 
                last_seen = CURRENT_TIMESTAMP 
            WHERE user_id = $1
        `;
        
        await pool.query(saveQuery, [
            userId, 
            balance || 0, 
            energy || 0, 
            max_energy || 1000, 
            click_lvl || 1, 
            wallet || null, 
            has_bot || false
        ]);
        
        res.json({ success: true, timestamp: Date.now() });
    } catch (e) { 
        console.error("SAVE ERROR:", e);
        res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT user_id, username, avatar_url, balance FROM users ORDER BY balance DESC LIMIT 50');
        res.json(r.rows);
    } catch (e) { res.json([]); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v3.1.2</b>\nСтатус: Синхронизация стабильна.`,
        Markup.inlineKeyboard([[Markup.button.webApp("OPEN CLUSTER", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { console.log("Pulse Server v3.1.2 Live"); bot.launch(); });
