const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');

const VERSION = "1.1.5";
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
        // Создаем таблицу
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0,
                referred_by TEXT,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS payments (
                tx_hash TEXT PRIMARY KEY, user_id TEXT, amount NUMERIC
            );
        `);

        // Прямое исправление структуры (если колонки пропали)
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pnl NUMERIC DEFAULT 0`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT`);
        
        console.log(`v${VERSION} запущен. БД проверена.`);
    } catch (err) { 
        console.error("Ошибка инициализации БД:", err.message); 
    }
};
initDB();

// Математика: +1 энергия и доход в секунду на сервере
setInterval(async () => {
    try {
        await pool.query(`
            UPDATE users 
            SET energy = LEAST(1000, energy + 1),
                balance = balance + (pnl / 3600)
            WHERE last_active > NOW() - INTERVAL '24 hours'
        `);
    } catch (e) {}
}, 1000);

// API: Получение/Создание пользователя
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const refBy = req.query.refBy;
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, referred_by) VALUES ($1, $2)', [uid, refBy]);
            if (refBy && refBy !== uid) {
                await pool.query('UPDATE users SET balance = balance + 50000 WHERE user_id = $1', [refBy]);
            }
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API: Сохранение состояния
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    try {
        await pool.query(`
            UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5, last_active = CURRENT_TIMESTAMP
            WHERE user_id = $1
        `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl)]);
        res.json({ status: 'ok' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API: Прокачка клика
app.post('/api/upgrade/click', async (req, res) => {
    const { userId } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)]);
        if (user.rows.length > 0) {
            const cost = user.rows[0].click_lvl * 5000;
            if (user.rows[0].balance >= cost) {
                await pool.query('UPDATE users SET balance = balance - $1, click_lvl = click_lvl + 1 WHERE user_id = $2', [cost, userId]);
                return res.json({ success: true });
            }
        }
        res.json({ success: false });
    } catch (err) { res.json({ success: false }); }
});

// API: Лидерборд
app.get('/api/leaderboard', async (req, res) => {
    const result = await pool.query('SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT 10');
    res.json(result.rows);
});

// API: Проверка платежа TON
app.get('/api/check-payment/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        const response = await axios.get(`https://toncenter.com/api/v2/getTransactions?address=${MY_WALLET}&limit=10`);
        const txs = response.data.result;
        for (let tx of txs) {
            const hash = tx.transaction_id.hash;
            const msg = tx.in_msg;
            if (msg?.message?.includes(`ID${uid}`)) {
                const exist = await pool.query('SELECT * FROM payments WHERE tx_hash = $1', [hash]);
                if (exist.rows.length === 0) {
                    await pool.query('INSERT INTO payments (tx_hash, user_id) VALUES ($1, $2)', [hash, uid]);
                    await pool.query('UPDATE users SET balance = balance + 1000000 WHERE user_id = $1', [uid]);
                    return res.json({ success: true, added: 1000000 });
                }
            }
        }
        res.json({ success: false });
    } catch (e) { res.status(500).send(); }
});

bot.start(ctx => ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}${ctx.startPayload ? '?tgWebAppStartParam=' + ctx.startPayload : ''}`)]])));
app.listen(PORT, () => { console.log(`v${VERSION} Running`); bot.launch(); });
