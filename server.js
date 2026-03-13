const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const MY_WALLET = "EQB8m_p-6T_0Z_8...ВАШ_КОШЕЛЕК..."; // ЗАМЕНИТЕ НА СВОЙ
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0,
                wallet_address TEXT
            );
            CREATE TABLE IF NOT EXISTS payments (
                tx_hash TEXT PRIMARY KEY,
                user_id TEXT,
                amount NUMERIC
            );
        `);
    } catch (err) { console.error("DB Error:", err.message); }
};
initDB();

// Проверка транзакций через Toncenter
app.get('/api/check-payment/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        // Запрос последних транзакций вашего кошелька
        const response = await axios.get(`https://toncenter.com/api/v2/getTransactions?address=${MY_WALLET}&limit=10`);
        const txs = response.data.result;
        
        for (let tx of txs) {
            const hash = tx.transaction_id.hash;
            const msg = tx.in_msg;
            if (!msg) continue;
            
            // Ищем комментарий, который начинается с ID пользователя
            const comment = msg.message;
            const amount = Number(msg.value) / 10**9; // Перевод в TON

            if (comment && comment.includes(`ID${uid}`)) {
                // Проверяем, не обрабатывали ли мы этот хэш ранее
                const exist = await pool.query('SELECT * FROM payments WHERE tx_hash = $1', [hash]);
                if (exist.rows.length === 0) {
                    const bonusCoins = 1000000; // 1,000,000 монет за 1 TON
                    await pool.query('INSERT INTO payments (tx_hash, user_id, amount) VALUES ($1, $2, $3)', [hash, uid, amount]);
                    await pool.query('UPDATE users SET balance = balance + $1 WHERE user_id = $2', [bonusCoins, uid]);
                    
                    return res.json({ success: true, added: bonusCoins });
                }
            }
        }
        res.json({ success: false });
    } catch (e) { res.status(500).json({ error: "TON API Error" }); }
});

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (result.rows.length === 0) {
            const newUser = await pool.query('INSERT INTO users (user_id) VALUES ($1) RETURNING *', [uid]);
            return res.json(newUser.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    try {
        await pool.query(`
            INSERT INTO users (user_id, balance, energy, click_lvl, pnl)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
            balance = EXCLUDED.balance, energy = EXCLUDED.energy,
            click_lvl = EXCLUDED.click_lvl, pnl = EXCLUDED.pnl
        `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl)]);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: "Save Fail" }); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE AI</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]]));
});

app.listen(PORT, () => {
    console.log(`Server: https://${DOMAIN}`);
    bot.launch();
});
