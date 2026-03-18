const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Инициализация базы данных (v3.8.0 Stable с авто-исправлением)
const initDB = async () => {
    try {
        // 1. Создаем таблицу, если её нет вообще
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                avatar_url TEXT DEFAULT '', 
                balance NUMERIC(20, 0) DEFAULT 696, 
                energy INTEGER DEFAULT 543, 
                max_energy INTEGER DEFAULT 1000, 
                click_lvl INTEGER DEFAULT 1, 
                profit_hr NUMERIC(20, 0) DEFAULT 0,
                lvl INTEGER DEFAULT 2,
                wallet_addr TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        // 2. ФИКС ОШИБКИ: Насильно добавляем колонки в уже существующую таблицу
        // Это уберет ошибку "column lvl does not exist" из логов Bothost
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lvl INTEGER DEFAULT 2`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profit_hr NUMERIC(20, 0) DEFAULT 0`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS click_lvl INTEGER DEFAULT 1`);
        
        console.log("Database Ready v3.8.0 Stable (Structure verified)");
    } catch (e) { 
        console.error("Critical DB Error:", e); 
    }
};
initDB();

// API: Получение данных пользователя
app.get('/api/user/:id', async (req, res) => {
    const { name, photo } = req.query;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        if (!r.rows.length) {
            // Создание нового пользователя с параметрами стабильной версии 3.8.0
            await pool.query(
                'INSERT INTO users (user_id, username, avatar_url, balance, energy, lvl) VALUES ($1, $2, $3, 696, 543, 2)', 
                [req.params.id, name || 'Agent', photo || '']
            );
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).send(e.message); }
});

// API: Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, profit_hr, lvl } = req.body;
    
    // Защита от бесконечных дробей и пустых значений
    const safeBalance = Math.floor(balance || 0);
    const safeProfit = Math.floor(profit_hr || 0);

    try {
        await pool.query(`
            UPDATE users SET 
                balance = $2, 
                energy = $3, 
                max_energy = $4, 
                click_lvl = $5, 
                profit_hr = $6, 
                lvl = $7, 
                last_seen = CURRENT_TIMESTAMP 
            WHERE user_id = $1`, 
            [userId, safeBalance, energy, max_energy, click_lvl || 1, safeProfit, lvl || 2]
        );
        res.json({ ok: true });
    } catch (e) { 
        console.error("Save Error:", e.message);
        res.status(500).send(e.message); 
    }
});

bot.start((ctx) => {
    ctx.replyWithHTML(
        `<b>Neural Pulse v3.8.0 Stable</b>\nДобро пожаловать, агент!`, 
        Markup.inlineKeyboard([
            [Markup.button.webApp("ОТКРЫТЬ ПРИЛОЖЕНИЕ", "https://neural-pulse.bothost.ru")]
        ])
    );
});

const PORT = 3000;
app.listen(PORT, () => { 
    console.log(`Server running on port ${PORT}`); 
    bot.launch(); 
});
