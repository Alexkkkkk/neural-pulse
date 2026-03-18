const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// 1. Логирование инициализации пула
console.log("🛠 [DB] Попытка создания пула подключений...");
const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false 
});

// Отслеживаем критические ошибки пула в реальном времени
pool.on('error', (err) => {
    console.error('🚨 [DB FATAL] Непредвиденная ошибка в пуле PostgreSQL:', err.message);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// 2. Детальная инициализация таблицы
const initDB = async () => {
    console.log("⏳ [DB] Проверка структуры таблиц...");
    try {
        const startTime = Date.now();
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
                ref_by TEXT, 
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        const duration = Date.now() - startTime;
        console.log(`✅ [DB] Таблица 'users' готова к работе (${duration}ms). SSL: OFF`);
    } catch (e) { 
        console.error("❌ [DB ERROR] Ошибка при старте базы данных:");
        console.error("👉 Сообщение:", e.message);
        console.error("👉 Код ошибки:", e.code);
    }
};
initDB();

// 3. Логирование получения данных (GET)
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    console.log(`📡 [API GET] Запрос данных пользователя: ${userId}`);
    
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        
        if (result.rows.length === 0) {
            console.log(`🆕 [DB] Новый пользователь! Создаем запись для ${userId}...`);
            await pool.query(
                `INSERT INTO users (user_id, username) VALUES ($1, $2)`, 
                [userId, 'Agent']
            );
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        
        const user = result.rows[0];
        console.log(`🟢 [DB] Данные для ${userId} успешно отправлены.`);
        res.json({
            ...user,
            balance: parseFloat(user.balance) || 0,
            profit_hr: parseFloat(user.profit_hr) || 0
        });
    } catch (e) { 
        console.error(`❌ [DB ERROR] Ошибка GET /api/user/${userId}:`, e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// 4. Логирование сохранения данных (POST)
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy } = req.body;
    
    try {
        const result = await pool.query(`
            UPDATE users SET 
                balance = $2, energy = $3, max_energy = $4, 
                click_lvl = $5, profit_hr = $6, lvl = $7, 
                last_seen = CURRENT_TIMESTAMP WHERE user_id = $1`, 
            [userId, Math.floor(balance), Math.floor(energy), req.body.max_energy, req.body.click_lvl, Math.floor(req.body.profit_hr), req.body.lvl]
        );

        if (result.rowCount > 0) {
            console.log(`💾 [DB] Прогресс сохранен для пользователя: ${userId} (Баланс: ${Math.floor(balance)})`);
        } else {
            console.warn(`⚠️ [DB] Попытка сохранения для несуществующего ID: ${userId}`);
        }
        res.json({ ok: true });
    } catch (e) { 
        console.error(`❌ [DB ERROR] Ошибка сохранения для ${userId}:`, e.message);
        res.status(500).send(e.message); 
    }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v3.8.1</b>`, 
        Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { 
    console.log(`🚀 [SERVER] Запущен на порту 3000`); 
    bot.launch().then(() => console.log("🤖 [BOT] Телеграм бот запущен успешно."));
});
