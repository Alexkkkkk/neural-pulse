const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.9.9.6";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/tonconnect-manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(path.join(__dirname, 'public', 'tonconnect-manifest.json'));
});

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
    const name = req.query.name || 'Neural Player';
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [uid, name]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        res.json({ ...r.rows[0], server_v: VERSION });
    } catch (e) { res.status(500).json({ error: "Read Error" }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, username, balance, energy, max_energy, click_lvl, pnl, wallet, friends_count } = req.body;
    try {
        await pool.query(
            `UPDATE users SET username=$2, balance=$3, energy=$4, max_energy=$5, click_lvl=$6, pnl=$7, wallet_address=$8, friends_count=$9, last_sync=NOW() WHERE user_id=$1`, 
            [String(userId), username, Number(balance), Number(energy), Number(max_energy), Number(click_lvl), Number(pnl), wallet, Number(friends_count)]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save Error" }); }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 10');
        res.json(r.rows);
    } catch (e) { res.status(500).json([]); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://neural-pulse.bothost.ru`)]]));
});

app.listen(3000, () => { console.log(`Server v${VERSION} Online`); bot.launch(); });
