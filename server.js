const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

// Данные подключения
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// ВАЖНО: ssl: false исправляет ошибку "The server does not support SSL connections"
const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- Инициализация БД с логированием ---
const initDB = async () => {
    console.log("🛠 [DB] Connecting to database...");
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
                lvl INTEGER DEFAULT 1,
                wallet TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("✅ [DB] System Ready and Tables checked");
    } catch (e) { 
        console.error("❌ [DB ERROR] Critical failure during init:", e.message); 
    }
};
initDB();

// --- API: Получение/Создание пользователя ---
app.get('/api/user/:id', async (req, res) => {
    const userId = String(req.params.id);
    const username = req.query.username || 'Agent';
    
    console.log(`📡 [GET] User request: ID ${userId} (${username})`);
    
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        
        if (result.rows.length === 0) {
            console.log(`🆕 [DB] Creating new user: ${userId}`);
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [userId, username]);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        } else {
            console.log(`📝 [DB] Updating last_seen for: ${userId}`);
            await pool.query('UPDATE users SET username = $2, last_seen = NOW() WHERE user_id = $1', [userId, username]);
        }
        
        res.json(result.rows[0]);
    } catch (e) { 
        console.error(`❌ [API ERROR] /api/user/${userId}:`, e.message);
        res.status(500).json({ error: "Database error", details: e.message }); 
    }
});

// --- API: Сохранение прогресса ---
app.post('/api/save', async (req, res) => {
    const d = req.body;
    if (!d.userId) {
        console.warn("⚠️ [SAVE] Attempt to save without userId");
        return res.status(400).json({ error: "No UserID" });
    }

    try {
        console.log(`💾 [SAVE] Updating data for: ${d.userId} (Balance: ${d.balance})`);
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, profit_hr=$6, lvl=$7 WHERE user_id=$1`, 
            [String(d.userId), d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl]
        );
        res.json({ ok: true });
    } catch (e) { 
        console.error(`❌ [API ERROR] /api/save for ${d.userId}:`, e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// --- API: Сохранение кошелька ---
app.post('/api/wallet', async (req, res) => {
    const { userId, address } = req.body;
    console.log(`🔗 [WALLET] Connecting wallet for ${userId}: ${address}`);
    try {
        await pool.query('UPDATE users SET wallet = $2 WHERE user_id = $1', [String(userId), address]);
        res.json({ ok: true });
    } catch (e) { 
        console.error(`❌ [API ERROR] /api/wallet:`, e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// --- API: Топ игроков ---
app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 50');
        console.log(`🏆 [TOP] Requested top players list`);
        res.json(result.rows);
    } catch (e) { 
        console.error(`❌ [API ERROR] /api/top:`, e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// --- Бот и Сервер ---
bot.start((ctx) => {
    const name = ctx.from.first_name;
    console.log(`🤖 [BOT] Started by: ${ctx.from.id} (${name})`);
    ctx.replyWithHTML(`<b>Neural Pulse</b>\nДобро пожаловать, ${name}!`, 
        Markup.inlineKeyboard([
            [Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]
        ])
    );
});

// Глобальный лог ошибок бота
bot.catch((err, ctx) => {
    console.error(`❌ [TELEGRAF ERROR] for update ${ctx.updateType}:`, err);
});

app.listen(3000, () => {
    console.log(`\n---------------------------------`);
    console.log(`🚀 Server started on port 3000`);
    console.log(`🌍 URL: https://neural-pulse.bothost.ru`);
    console.log(`---------------------------------\n`);
});

bot.launch().then(() => console.log("🤖 [BOT] Polling started..."));

// Плавная остановка
process.once('SIGINT', () => { bot.stop('SIGINT'); pool.end(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); pool.end(); });
