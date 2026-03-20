const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

// Данные подключения
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "https://neural-pulse.bothost.ru"; // Твой домен

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- MIDDLEWARE ДЛЯ ВЕБХУКА ---
// Telegram будет слать обновления на этот секретный путь
const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- Инициализация БД ---
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
        console.log("✅ [DB] System Ready");
    } catch (e) { 
        console.error("❌ [DB ERROR] Critical failure:", e.message); 
    }
};
initDB();

// --- API: Эндпоинты (без изменений) ---

app.get('/api/user/:id', async (req, res) => {
    const userId = String(req.params.id);
    const username = req.query.username || 'Agent';
    console.log(`📡 [GET] User: ${userId}`);
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [userId, username]);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const d = req.body;
    console.log(`💾 [SAVE] User: ${d.userId} | Balance: ${d.balance}`);
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, profit_hr=$6, lvl=$7 WHERE user_id=$1`, 
            [String(d.userId), d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/top', async (req, res) => {
    console.log(`🏆 [TOP] Fetching leaderboard...`);
    try {
        // Выбираем ID, имя и баланс для ТОПа
        const result = await pool.query('SELECT user_id, username, balance FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ЛОГИКА БОТА ---
bot.start((ctx) => {
    console.log(`🤖 [WEBHOOK] Start command from: ${ctx.from.id}`);
    ctx.replyWithHTML(`<b>Neural Pulse</b>\nReady to mine, ${ctx.from.first_name}?`, 
        Markup.inlineKeyboard([
            [Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]
        ])
    );
});

// Глобальный лог ошибок бота
bot.catch((err, ctx) => {
    console.error(`❌ [TELEGRAF ERROR] ${ctx.updateType}:`, err);
});

// --- ЗАПУСК СЕРВЕРА И УСТАНОВКА WEBHOOK ---
const PORT = 3000;
app.listen(PORT, async () => {
    console.log(`\n---------------------------------`);
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`🌍 Domain: ${DOMAIN}`);
    
    try {
        console.log(`📡 [WEBHOOK] Setting up connection to Telegram...`);
        // Устанавливаем вебхук в Telegram
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        const info = await bot.telegram.getWebhookInfo();
        console.log(`✅ [WEBHOOK] Telegram link established!`);
        console.log(`📝 [WEBHOOK] URL: ${info.url}`);
        console.log(`---------------------------------\n`);
    } catch (e) {
        console.error(`❌ [WEBHOOK ERROR] Failed to set webhook:`, e.message);
    }
});

// Плавная остановка
process.once('SIGINT', () => pool.end());
process.once('SIGTERM', () => pool.end());
