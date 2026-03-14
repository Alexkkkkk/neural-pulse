// Version: 1.3.9
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.3.9";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, balance NUMERIC DEFAULT 0)`);
        const columns = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS energy INTEGER DEFAULT 1000",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS click_lvl INTEGER DEFAULT 1",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS pnl NUMERIC DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS rank TEXT DEFAULT 'Bronze Node'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS offline_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_count INTEGER DEFAULT 0"
        ];
        for (let cmd of columns) { try { await pool.query(cmd); } catch (e) {} }
        console.log(`v${VERSION} Database Synced`);
    } catch (err) { console.error(err); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    try {
        const uid = String(req.params.id);
        const ref = req.query.ref;
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, referred_by) VALUES ($1, $2)', [uid, (ref && ref !== uid) ? ref : null]);
            if (ref && ref !== uid) {
                await pool.query('UPDATE users SET balance = balance + 5000, ref_count = ref_count + 1 WHERE user_id = $1', [ref]);
            }
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Новый маршрут для получения ТОП-15 игроков
app.get('/api/stats', async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, balance, rank FROM users ORDER BY balance DESC LIMIT 15');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    try {
        const { userId, balance, energy, click_lvl, pnl, rank } = req.body;
        await pool.query(`
            UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5, rank = $6, 
            last_active = CURRENT_TIMESTAMP, offline_sync = CURRENT_TIMESTAMP
            WHERE user_id = $1
        `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl), rank]);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

bot.start(async (ctx) => {
    const refId = ctx.startPayload;
    const url = `https://${DOMAIN}?ref=${refId || ''}`;
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', url)]]));
});

app.listen(PORT, () => { console.log(`v${VERSION} Online`); bot.launch(); });
