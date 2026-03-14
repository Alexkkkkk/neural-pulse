const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');

const VERSION = "1.1.3";
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
        // Создаем таблицу, если её нет
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
        `);

        // ИСПРАВЛЕНИЕ ОШИБКИ: Добавляем колонку last_active, если таблица была создана раньше
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pnl NUMERIC DEFAULT 0`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT`);
        
        console.log(`v${VERSION} запущен. Ошибка колонок устранена.`);
    } catch (err) { 
        console.error("Ошибка инициализации БД:", err.message); 
    }
};
initDB();

// Математика: +1 энергия и доход в секунду (Исправленный запрос)
setInterval(async () => {
    try {
        await pool.query(`
            UPDATE users 
            SET energy = LEAST(1000, energy + 1),
                balance = balance + (pnl / 3600)
            WHERE last_active > NOW() - INTERVAL '24 hours'
        `);
    } catch (e) {
        // Если колонка всё еще не видна (редкий лаг PG), пропускаем тик
    }
}, 1000);

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

bot.start(ctx => ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}${ctx.startPayload ? '?tgWebAppStartParam=' + ctx.startPayload : ''}`)]])));
app.listen(PORT, () => { console.log(`v${VERSION} Running`); bot.launch(); });
