const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.9.5";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация БД с защитой от пустых значений
const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, 
            username TEXT DEFAULT 'Neural Player',
            photo_url TEXT DEFAULT NULL,
            balance NUMERIC DEFAULT 0,
            energy NUMERIC DEFAULT 1000,
            max_energy NUMERIC DEFAULT 1000,
            click_lvl NUMERIC DEFAULT 1,
            pnl NUMERIC DEFAULT 0,
            wallet_address TEXT DEFAULT NULL
        )`);
        console.log(`[v${VERSION}] DB Connected`);
    } catch (e) { console.error(`[v${VERSION}] DB Error:`, e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const name = req.query.name || 'Neural Player';
    const photo = req.query.photo || '';
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username, photo_url, balance, energy, max_energy, click_lvl, pnl) VALUES ($1, $2, $3, 0, 1000, 1000, 1, 0)', [uid, name, photo]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        } else {
            await pool.query('UPDATE users SET username=$2, photo_url=$3 WHERE user_id=$1', [uid, name, photo]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: "Read Error" }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, pnl, wallet } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, pnl=$6, wallet_address=$7 WHERE user_id=$1`, 
            [String(userId), Number(balance)||0, Number(energy)||0, Number(max_energy)||1000, Number(click_lvl)||1, Number(pnl)||0, wallet]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save Error" }); }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT username, balance, photo_url FROM users WHERE username IS NOT NULL AND username != \'null\' ORDER BY balance DESC LIMIT 50');
        res.json(r.rows);
    } catch (e) { res.status(500).json([]); }
});

app.listen(3000, () => { console.log(`Server v${VERSION} Online`); bot.launch(); });
