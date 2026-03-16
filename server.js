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

// Крутая инициализация базы: магия "безболезненного" добавления колонок через ALTER
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT DEFAULT 'Agent',
                avatar_url TEXT DEFAULT '',
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                max_energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                wallet_addr TEXT,
                has_bot BOOLEAN DEFAULT FALSE,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Магия: автоматическая проверка наличия новых колонок (пример для будущего)
        // await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals INTEGER DEFAULT 0`);
        console.log("Database v3.1.0 Ready");
    } catch (e) { console.error("DB Init Error:", e); }
};
initDB();

// Обработка пользователя с жесткой валидацией данных (решает проблему NaN)
app.get('/api/user/:id', async (req, res) => {
    const { name, photo } = req.query;
    const uid = req.params.id;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        const vName = (name && name !== 'null' && name !== 'undefined') ? name : 'Agent';
        const vPhoto = (photo && photo !== 'null' && photo !== 'undefined') ? photo : '';

        if (!r.rows.length) {
            const newUser = await pool.query(
                'INSERT INTO users (user_id, username, avatar_url, balance, energy, max_energy, click_lvl) VALUES ($1, $2, $3, 0, 1000, 1000, 1) RETURNING *',
                [uid, vName, vPhoto]
            );
            return res.json(newUser.rows[0]);
        } else {
            // Обновляем метаданные, сохраняя прогресс
            const updated = await pool.query(
                'UPDATE users SET username=$1, avatar_url=$2 WHERE user_id=$3 RETURNING *',
                [vName, vPhoto, uid]
            );
            return res.json(updated.rows[0]);
        }
    } catch (e) { res.status(500).json({error: "Node Sync Error"}); }
});

// Безопасное сохранение с защитой от перезаписи меньшим значением
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    if(!userId || userId === "0") return res.status(400).send("Invalid ID");
    
    try {
        await pool.query(
            `UPDATE users SET 
                balance = GREATEST(balance, $2), 
                energy = $3, 
                max_energy = $4, 
                click_lvl = $5, 
                wallet_addr = $6, 
                has_bot = $7, 
                last_seen = CURRENT_TIMESTAMP 
             WHERE user_id = $1`,
            [userId, balance || 0, energy || 0, max_energy || 1000, click_lvl || 1, wallet, has_bot || false]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query(
            'SELECT user_id, username, avatar_url, balance FROM users WHERE username IS NOT NULL ORDER BY balance DESC LIMIT 50'
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json([]); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(
        `<b>Neural Pulse v3.1.0</b>\nКвантовый движок запущен. Все данные синхронизированы.`,
        Markup.inlineKeyboard([[Markup.button.webApp("ENTER NODE", "https://neural-pulse.bothost.ru")]])
    );
});

app.listen(3000, () => {
    console.log("Server Live: Port 3000");
    bot.launch();
});
