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

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                balance NUMERIC DEFAULT 0,  
                energy INTEGER DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                click_lvl INTEGER DEFAULT 1, 
                profit_hr NUMERIC DEFAULT 0,  
                lvl INTEGER DEFAULT 1
            )`);
        
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_liked BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        
        console.log("✅ [DB] База данных проверена и готова.");
    } catch (e) { console.error("❌ [DB INIT ERROR]", e.message); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    console.log(`🔍 [GET USER] Запрос для ID: ${userId}`);
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            console.log(`🆕 [NEW USER] Создаем игрока ${userId}`);
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [userId, 'Agent']);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        res.json(result.rows[0]);
    } catch (e) { 
        console.error("❌ [GET USER ERROR]", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/save', async (req, res) => {
    const d = req.body;
    console.log(`📥 [SAVE] Пытаемся сохранить ID: ${d.userId}, Баланс: ${d.balance}`);
    try {
        const result = await pool.query(`
            UPDATE users SET 
                balance = $2, energy = $3, max_energy = $4, 
                click_lvl = $5, profit_hr = $6, lvl = $7, 
                likes = $8, is_liked = $9,
                last_seen = CURRENT_TIMESTAMP WHERE user_id = $1`, 
            [d.userId, d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl, d.likes, d.is_liked]
        );
        
        if (result.rowCount > 0) {
            console.log(`✅ [SAVE] Данные ID: ${d.userId} обновлены.`);
            res.json({ ok: true });
        } else {
            console.warn(`⚠️ [SAVE] Пользователь ${d.userId} не найден для обновления.`);
            res.json({ ok: false, error: "not_found" });
        }
    } catch (e) { 
        console.error("❌ [SAVE ERROR]", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v4.0.0</b>`, 
        Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { 
    console.log(`🚀 [SERVER] Запущен на порту 3000`);
    bot.launch();
});
