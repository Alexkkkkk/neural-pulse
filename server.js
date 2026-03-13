const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const MY_WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"; 
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
                referred_by TEXT
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

app.get('/api/check-payment/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        const response = await axios.get(`https://toncenter.com/api/v2/getTransactions?address=${MY_WALLET}&limit=15`);
        const txs = response.data.result;
        for (let tx of txs) {
            const hash = tx.transaction_id.hash;
            const msg = tx.in_msg;
            if (!msg || !msg.message) continue;
            
            if (msg.message.includes(`ID${uid}`)) {
                const exist = await pool.query('SELECT * FROM payments WHERE tx_hash = $1', [hash]);
                if (exist.rows.length === 0) {
                    const bonus = 1000000;
                    await pool.query('INSERT INTO payments (tx_hash, user_id, amount) VALUES ($1, $2, $3)', [hash, uid, Number(msg.value)/10**9]);
                    await pool.query('UPDATE users SET balance = balance + $1 WHERE user_id = $2', [bonus, uid]);
                    return res.json({ success: true, added: bonus });
                }
            }
        }
        res.json({ success: false });
    } catch (e) { res.status(500).json({ error: "TON API Error" }); }
});

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const refBy = req.query.refBy;
    
    let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    
    if (result.rows.length === 0) {
        // Новый пользователь
        await pool.query('INSERT INTO users (user_id, referred_by) VALUES ($1, $2)', [uid, refBy]);
        
        // Если есть пригласитель - даем ему бонус 50,000 монет
        if (refBy && refBy !== uid) {
            await pool.query('UPDATE users SET balance = balance + 50000 WHERE user_id = $1', [refBy]);
        }
        
        result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    }
    res.json(result.rows[0]);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    await pool.query(`
        UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5 
        WHERE user_id = $1
    `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl)]);
    res.json({ status: 'ok' });
});

bot.start(ctx => {
    const startPayload = ctx.startPayload; // Это ID пригласителя из ссылки ?start=ID
    ctx.replyWithHTML(
        `<b>🚀 NEURAL PULSE AI</b>\n\nWelcome to the network. Start mining now!`, 
        Markup.inlineKeyboard([[
            Markup.button.webApp('⚡ START APP', `https://${DOMAIN}${startPayload ? '?tgWebAppStartParam=' + startPayload : ''}`)
        ]])
    );
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); bot.launch(); });
