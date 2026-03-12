const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// [1] КОНФИГУРАЦИЯ
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Настройка пула БД БЕЗ SSL (исправляет ошибку в логах)
const pool = new Pool({
    connectionString: PG_URI,
    ssl: false // Полностью отключаем SSL, так как сервер его не поддерживает
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [2] МАНИФЕСТ ДЛЯ TON CONNECT
app.get('/tonconnect-manifest.json', (req, res) => {
    res.json({
        "url": `https://${DOMAIN}`,
        "name": "Neural Pulse AI",
        "iconUrl": `https://${DOMAIN}/logo.png`
    });
});

// [3] ИНИЦИАЛИЗАЦИЯ БАЗЫ
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                balance NUMERIC DEFAULT 0,
                energy NUMERIC DEFAULT 1000,
                max_energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0,
                wallet_address TEXT,
                last_seen BIGINT DEFAULT extract(epoch from now())
            );
        `);
        console.log("📦 [DB] PostgreSQL подключена успешно.");
    } catch (err) {
        console.error("❌ [DB] Критическая ошибка:", err.message);
    }
};
initDB();

// [4] API
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    if (!uid || uid === "null" || uid === "undefined") return res.status(400).json({ error: "Invalid ID" });
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        let user;

        if (result.rows.length === 0) {
            const newUser = await pool.query(
                'INSERT INTO users (user_id, last_seen) VALUES ($1, extract(epoch from now())) RETURNING *', [uid]
            );
            user = newUser.rows[0];
        } else {
            user = result.rows[0];
        }
        
        const now = Math.floor(Date.now() / 1000);
        const lastSeen = parseInt(user.last_seen) || now;
        const secondsOffline = Math.max(0, now - lastSeen);
        
        user.balance = Number(user.balance) || 0;
        user.energy = Number(user.energy) || 1000;
        user.max_energy = Number(user.max_energy) || 1000;
        user.pnl = Number(user.pnl) || 0;
        user.click_lvl = parseInt(user.click_lvl) || 1;

        if (secondsOffline > 0) {
            if (user.pnl > 0) user.balance += (secondsOffline * user.pnl) / 3600;
            if (user.energy < user.max_energy) {
                user.energy = Math.min(user.max_energy, user.energy + (secondsOffline * 1.5));
            }
            await pool.query('UPDATE users SET balance = $1, energy = $2, last_seen = $3 WHERE user_id = $4',
                [user.balance, user.energy, now, uid]);
        }
        res.json(user);
    } catch (e) {
        console.error("API GET Error:", e.message);
        res.status(500).json({ error: "DB Error" });
    }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl, username, wallet_address } = req.body;
    try {
        await pool.query(`
            INSERT INTO users (user_id, balance, energy, click_lvl, pnl, username, wallet_address, last_seen)
            VALUES ($1, $2, $3, $4, $5, $6, $7, extract(epoch from now()))
            ON CONFLICT (user_id) DO UPDATE SET
            balance = $2, energy = $3, click_lvl = $4, pnl = $5, username = $6, wallet_address = $7, last_seen = extract(epoch from now())
        `, [String(userId), Number(balance), Number(energy), parseInt(click_lvl), Number(pnl), username, wallet_address]);
        res.json({ status: 'ok' });
    } catch (e) {
        console.error("API SAVE Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// [5] БОТ
bot.start((ctx) => {
    const gameUrl = `https://${DOMAIN}?v=${Date.now()}`;
    ctx.replyWithHTML(
        `<b>🚀 NEURAL PULSE AI</b>\n\nЗапускай майнер и подключай кошелек!`, 
        Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', gameUrl)]])
    );
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
bot.launch().catch(err => console.error("Bot launch error:", err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
