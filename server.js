const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.8.6";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
// Указываем папку public как статическую
app.use(express.static(path.join(__dirname, 'public')));

app.get('/tonconnect-manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(path.join(__dirname, 'public', 'tonconnect-manifest.json'));
});

// Роут для отдачи главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, 
            username TEXT DEFAULT 'Neural Player',
            balance NUMERIC DEFAULT 0,
            energy INTEGER DEFAULT 1000,
            max_energy INTEGER DEFAULT 1000,
            click_lvl INTEGER DEFAULT 1,
            pnl NUMERIC DEFAULT 0,
            wallet_address TEXT DEFAULT NULL,
            friends_count INTEGER DEFAULT 0,
            last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log(`[v${VERSION}] DB Connected`);
    } catch (e) { console.error(`[v${VERSION}] DB Error:`, e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id) VALUES ($1)', [uid]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        res.json({ ...r.rows[0], server_v: VERSION });
    } catch (e) { res.status(500).json({ error: "Read Error" }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, pnl, wallet, friends_count } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, pnl=$6, wallet_address=$7, friends_count=$8, last_sync=NOW() WHERE user_id=$1`, 
            [String(userId), balance, energy, max_energy, click_lvl, pnl, wallet, friends_count]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save Error" }); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://neural-pulse.bothost.ru`)]]));
});

app.listen(3000, () => { console.log(`Server running v${VERSION}`); bot.launch(); });
