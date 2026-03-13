const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const MY_WALLET = "EQB8m_p-6T_0Z_8...ВАШ_КОШЕЛЕК..."; // <--- ЗАМЕНИТЬ
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация БД с поддержкой транзакций
const setupDB = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            balance NUMERIC DEFAULT 0,
            energy INTEGER DEFAULT 1000,
            click_lvl INTEGER DEFAULT 1,
            pnl NUMERIC DEFAULT 0,
            last_seen BIGINT DEFAULT extract(epoch from now())
        );
        CREATE TABLE IF NOT EXISTS payments (
            tx_hash TEXT PRIMARY KEY, 
            user_id TEXT, 
            amount NUMERIC,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `);
};
setupDB();

// API Эндпоинты
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const uname = req.query.name || 'Anonymous';
    let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    if (r.rows.length === 0) {
        r = await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2) RETURNING *', [uid, uname]);
    } else {
        await pool.query('UPDATE users SET username = $1 WHERE user_id = $2', [uname, uid]);
    }
    const user = r.rows[0];
    const offSec = Math.floor(Date.now()/1000) - Number(user.last_seen);
    const bonus = (Number(user.pnl)/3600) * Math.min(offSec, 172800);
    res.json({ ...user, offline_bonus: bonus });
});

app.get('/api/leaderboard', async (req, res) => {
    const r = await pool.query('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 50');
    res.json(r.rows);
});

app.get('/api/my-payments/:id', async (req, res) => {
    const r = await pool.query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC', [String(req.params.id)]);
    res.json(r.rows);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    await pool.query(`
        UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5, last_seen = extract(epoch from now())
        WHERE user_id = $1
    `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl)]);
    res.json({ status: 'ok' });
});

app.get('/api/check-payment/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        const response = await axios.get(`https://toncenter.com/api/v2/getTransactions?address=${MY_WALLET}&limit=30`);
        if(!response.data.ok) return res.json({ success: false });

        for (let tx of response.data.result) {
            const hash = tx.transaction_id.hash;
            const msg = tx.in_msg?.message;
            if (msg && msg.includes(`ID${uid}`)) {
                const check = await pool.query('SELECT * FROM payments WHERE tx_hash = $1', [hash]);
                if (check.rows.length === 0) {
                    await pool.query('INSERT INTO payments (tx_hash, user_id, amount) VALUES ($1, $2, $3)', [hash, uid, 1]);
                    await pool.query('UPDATE users SET balance = balance + 1000000 WHERE user_id = $1', [uid]);
                    return res.json({ success: true, added: 1000000 });
                }
            }
        }
    } catch (e) { console.error("Sync Error"); }
    res.json({ success: false });
});

bot.start(ctx => ctx.replyWithHTML(`<b>SYSTEM ACCESS GRANTED</b>\n\nWelcome to Neural Pulse, ${ctx.from.first_name}.`, Markup.inlineKeyboard([
    [Markup.button.webApp('⚡ INITIALIZE', `https://${DOMAIN}`)]
])));

app.listen(PORT, () => { console.log(`Server: ${DOMAIN}`); bot.launch(); });
