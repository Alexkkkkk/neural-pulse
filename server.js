require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// 1. ПРОВЕРЕННЫЕ ДАННЫЕ
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const DOMAIN = "neural-pulse.bothost.ru";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const pool = new Pool({
    connectionString: PG_URI,
    ssl: false 
});

app.use(cors());
app.use(express.json());

// 2. ВАЖНО: Указываем серверу, где лежат файлы игры (папка public)
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация базы данных без удаления данных
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
        console.log("✅ [DB] Таблица готова к работе");
    } catch (err) {
        console.error("❌ [DB] Ошибка:", err.message);
    }
};
initDB();

// API для получения данных игрока
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    if (!uid || uid === "null") return res.status(400).json({ error: "Invalid ID" });
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (result.rows.length === 0) {
            const newUser = await pool.query(
                'INSERT INTO users (user_id) VALUES ($1) RETURNING *', [uid]
            );
            return res.json(newUser.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: "DB Error" });
    }
});

// API для сохранения прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl, username, wallet } = req.body;
    try {
        await pool.query(`
            INSERT INTO users (user_id, balance, energy, click_lvl, pnl, username, wallet, last_seen)
            VALUES ($1, $2, $3, $4, $5, $6, $7, extract(epoch from now()))
            ON CONFLICT (user_id) DO UPDATE SET
            balance = EXCLUDED.balance, energy = EXCLUDED.energy, click_lvl = EXCLUDED.click_lvl, 
            pnl = EXCLUDED.pnl, username = EXCLUDED.username, wallet = EXCLUDED.wallet,
            last_seen = extract(epoch from now())
        `, [String(userId), balance, energy, click_lvl, pnl, username, wallet]);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Роут для главной страницы (чтобы не показывал код текстом)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск Telegram бота
bot.start((ctx) => {
    const gameUrl = `https://${DOMAIN}?u=${ctx.from.id}`;
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE AI</b>\n\nБот активирован! Жми кнопку и начни майнинг.`, 
        Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', gameUrl)]])
    );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер работает на порту ${PORT}`);
    bot.launch().catch(err => console.error("TG Error:", err.message));
});
