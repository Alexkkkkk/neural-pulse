const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

// --- КОНФИГУРАЦИЯ ---
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "https://neural-pulse.bothost.ru"; 
const PORT = 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Подключение к БД
const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- MIDDLEWARE ДЛЯ ЛОГИРОВАНИЯ HTTP ---
app.use((req, res, next) => {
    if (!req.url.includes('telegraf')) { // Не спамим логами вебхука телеграма
        console.log(`[${new Date().toISOString().slice(11, 19)}] 📡 ${req.method} ${req.url}`);
    }
    next();
});

// Настройка Webhook пути
const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
const initDB = async () => {
    console.log("🛠 [DB] Checking tables...");
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
        console.log("✅ [DB] Database is ready and synchronized");
    } catch (e) { 
        console.error("❌ [DB ERROR] Initial setup failed:", e.message); 
    }
};
initDB();

// --- API ЭНДПОИНТЫ ---

// Получение/Создание юзера
app.get('/api/user/:id', async (req, res) => {
    const userId = String(req.params.id);
    const username = req.query.username || 'Agent';
    
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            console.log(`🆕 [DB] New player detected: ${username} (${userId})`);
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [userId, username]);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        } else {
            // Обновляем имя и время входа
            await pool.query('UPDATE users SET username = $2, last_seen = NOW() WHERE user_id = $1', [userId, username]);
        }
        res.json(result.rows[0]);
    } catch (e) { 
        console.error(`❌ [API ERROR] User ${userId}:`, e.message);
        res.status(500).json({ error: "Database error" }); 
    }
});

// Сохранение прогресса (вызывается из logic.js)
app.post('/api/save', async (req, res) => {
    const d = req.body;
    if (!d.userId) return res.status(400).json({ error: "Missing userId" });

    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, profit_hr=$6, lvl=$7 WHERE user_id=$1`, 
            [String(d.userId), d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl]
        );
        res.json({ ok: true });
    } catch (e) { 
        console.error(`❌ [API ERROR] Save failed for ${d.userId}:`, e.message);
        res.status(500).json({ error: "Save failed" }); 
    }
});

// Глобальный ТОП
app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, username, balance FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { 
        console.error("❌ [API ERROR] Top fetch:", e.message);
        res.status(500).json({ error: "Leaderboard error" }); 
    }
});

// --- ЛОГИКА ТЕЛЕГРАМ БОТА ---

bot.start((ctx) => {
    const from = ctx.from;
    console.log(`🤖 [BOT] Start command: ${from.first_name} (@${from.username || 'none'})`);
    
    ctx.replyWithHTML(
        `<b>Neural Pulse | System Online</b>\n\nWelcome, agent <b>${from.first_name}</b>. Ready to synchronize with the network?`, 
        Markup.inlineKeyboard([
            [Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", DOMAIN)]
        ])
    );
});

// Лог ошибок Telegraf
bot.catch((err, ctx) => {
    console.error(`❌ [TELEGRAF ERROR] Update ${ctx.updateType}:`, err);
});

// --- ЗАПУСК ---

app.listen(PORT, async () => {
    console.log(`\n---------------------------------`);
    console.log(`🚀 NEURAL SERVER STARTED ON PORT ${PORT}`);
    console.log(`🌍 DOMAIN: ${DOMAIN}`);
    
    try {
        console.log(`📡 [WEBHOOK] Connecting to Telegram API...`);
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        const info = await bot.telegram.getWebhookInfo();
        console.log(`✅ [WEBHOOK] Link established! Pending updates: ${info.pending_update_count}`);
        console.log(`📝 [WEBHOOK] Target: ${info.url}`);
        console.log(`---------------------------------\n`);
    } catch (e) {
        console.error(`❌ [WEBHOOK ERROR] Set failed:`, e.message);
    }
});

// Грамотное завершение
process.once('SIGINT', () => { 
    console.log("🛑 SIGINT received. Shutting down...");
    pool.end(); 
});
process.once('SIGTERM', () => { 
    console.log("🛑 SIGTERM received. Shutting down...");
    pool.end(); 
});
