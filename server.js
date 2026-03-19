const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

/**
 * Инициализация БД: Создание таблицы и добавление недостающих колонок
 */
const initDB = async () => {
    try {
        // 1. Создаем таблицу, если ее вообще нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                balance NUMERIC DEFAULT 0,  
                energy INTEGER DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                click_lvl INTEGER DEFAULT 1, 
                profit_hr NUMERIC DEFAULT 0,  
                lvl INTEGER DEFAULT 1,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        // 2. Добавляем колонки, которых может не быть в старой структуре
        // Это исправит ошибку "column photo_url does not exist"
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT 'logo.png'");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_liked BOOLEAN DEFAULT FALSE");

        console.log("✅ [DB] Database initialized and structure updated");
    } catch (e) { 
        console.error("❌ [DB ERROR]", e.message); 
    }
};
initDB();

// --- API: Получение данных пользователя ---
app.get('/api/user/:id', async (req, res) => {
    const userId = String(req.params.id);
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        
        if (result.rows.length === 0) {
            // При создании нового юзера сразу указываем photo_url
            await pool.query(
                'INSERT INTO users (user_id, username, balance, energy, max_energy, photo_url) VALUES ($1, $2, $3, $4, $5, $6)', 
                [userId, 'Agent', 0, 1000, 1000, 'logo.png']
            );
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        res.json(result.rows[0]);
    } catch (e) { 
        console.error("API User Error:", e.message);
        res.status(500).json({ error: "Database error" }); 
    }
});

// --- API: ТОП 100 Игроков ---
app.get('/api/top', async (req, res) => {
    try {
        // Теперь photo_url точно существует в таблице
        const result = await pool.query(`
            SELECT user_id, username as name, photo_url, balance 
            FROM users 
            ORDER BY balance DESC 
            LIMIT 100
        `);
        res.json(result.rows || []);
    } catch (e) { 
        console.error("API Top Error:", e.message);
        res.status(500).json({ error: "Leaderboard failed" }); 
    }
});

// --- API: Сохранение прогресса ---
app.post('/api/save', async (req, res) => {
    const d = req.body;
    if (!d.userId) return res.status(400).json({ error: "No userId" });
    try {
        await pool.query(`
            UPDATE users SET 
                balance = $2, energy = $3, max_energy = $4, 
                click_lvl = $5, profit_hr = $6, lvl = $7, 
                username = $8, photo_url = $9,
                last_seen = CURRENT_TIMESTAMP 
            WHERE user_id = $1`, 
            [
                String(d.userId), d.balance, d.energy, d.max_energy, 
                d.click_lvl, d.profit_hr, d.lvl, 
                d.username || 'Agent', d.photo_url || 'logo.png'
            ]
        );
        res.json({ ok: true });
    } catch (e) { 
        console.error("Save Error:", e.message);
        res.status(500).json({ error: "Save failed" }); 
    }
});

// --- Telegram Bot ---
bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v4.0.0</b>\nДобро пожаловать в майнинг будущего!`, 
        Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]]));
});

// Запуск сервера
app.listen(3000, () => {
    console.log(`🚀 Server running on port 3000`);
    bot.launch();
});
