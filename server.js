const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const pool = new Pool({
    connectionString: PG_URI,
    ssl: false // Отключено для внутренней сети Bothost
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Манифест для кошелька
app.get('/tonconnect-manifest.json', (req, res) => {
    res.json({
        "url": `https://${DOMAIN}`,
        "name": "Neural Pulse AI",
        "iconUrl": `https://${DOMAIN}/logo.png`
    });
});

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0,
                wallet_address TEXT,
                last_seen BIGINT DEFAULT extract(epoch from now())
            );
        `);
        console.log("📦 [DB] База готова.");
    } catch (err) { console.error("❌ [DB] Ошибка:", err.message); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (result.rows.length === 0) {
            const newUser = await pool.query('INSERT INTO users (user_id, last_seen) VALUES ($1, extract(epoch from now())) RETURNING *', [uid]);
            return res.json(newUser.rows[0]);
        }
        let user = result.rows[0];
        // Логика начисления оффлайн дохода... (как в твоем коде)
        res.json(user);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl, username, wallet_address } = req.body;
    try {
        await pool.query(`
            INSERT INTO users (user_id, balance, energy, click_lvl, pnl, username, wallet_address, last_seen)
            VALUES ($1, $2, $3, $4, $5, $6, $7, extract(epoch from now()))
            ON CONFLICT (user_id) DO UPDATE SET
            balance=$2, energy=$3, click_lvl=$4, pnl=$5, username=$6, wallet_address=$7, last_seen=extract(epoch from now())
        `, [String(userId), balance, Math.floor(energy), click_lvl, pnl, username, wallet_address]);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

bot.start((ctx) => {
    const gameUrl = `https://${DOMAIN}?v=${Date.now()}`;
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE AI</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', gameUrl)]]));
});

app.listen(PORT, () => {
    bot.launch();
    console.log(`🚀 Server on ${PORT}`);
});
