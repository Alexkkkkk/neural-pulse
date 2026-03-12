require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const DOMAIN = "neural-pulse.bothost.ru";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация таблицы
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
                wallet TEXT,
                last_seen BIGINT DEFAULT extract(epoch from now())
            );
        `);
        console.log("✅ [DB] Подключено и готово");
    } catch (err) {
        console.error("❌ [DB] Ошибка:", err.message);
    }
};
initDB();

// API: Получение данных игрока
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    if (!uid || uid === "null") return res.status(400).json({ error: "Invalid ID" });
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        let user;
        if (result.rows.length === 0) {
            const newUser = await pool.query(
                'INSERT INTO users (user_id, balance, energy, click_lvl) VALUES ($1, 0, 1000, 1) RETURNING *', 
                [uid]
            );
            user = newUser.rows[0];
        } else {
            user = result.rows[0];
        }
        res.json({
            user_id: user.user_id,
            balance: Number(user.balance) || 0,
            energy: Number(user.energy) || 1000,
            click_lvl: Number(user.click_lvl) || 1
        });
    } catch (e) {
        res.status(500).json({ error: "DB Error" });
    }
});

// API: Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl } = req.body;
    try {
        await pool.query(`
            INSERT INTO users (user_id, balance, energy, click_lvl)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET balance = $2, energy = $3, click_lvl = $4
        `, [String(userId), balance, energy, click_lvl]);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE AI</b>`, 
        Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}?u=${ctx.from.id}`)]])
    );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер на порту ${PORT}`);
    bot.launch().catch(err => console.error("TG Error:", err.message));
});
