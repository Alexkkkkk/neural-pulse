const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

// Конфигурация
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Инициализация структуры БД v3.8.0
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                avatar_url TEXT DEFAULT '', 
                balance NUMERIC DEFAULT 0, 
                energy INTEGER DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000, 
                click_lvl INTEGER DEFAULT 1, 
                profit_hr NUMERIC DEFAULT 0,
                lvl INTEGER DEFAULT 1,
                ref_by TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        // Фикс для существующих таблиц (добавление колонок если их нет)
        const columns = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS lvl INTEGER DEFAULT 1",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS profit_hr NUMERIC DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS click_lvl INTEGER DEFAULT 1",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_by TEXT"
        ];
        for (let sql of columns) { await pool.query(sql); }
        
        console.log("✅ Database System v3.8.0: Online & Verified");
    } catch (e) { console.error("❌ Critical DB Error:", e); }
};
initDB();

// API: Получение данных пользователя
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const refBy = req.query.ref || null;

    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        
        if (result.rows.length === 0) {
            // Создаем нового пользователя
            await pool.query(
                `INSERT INTO users (user_id, username, ref_by, balance, energy, lvl) 
                 VALUES ($1, $2, $3, 0, 1000, 1)`, 
                [userId, 'Agent', refBy]
            );
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        
        const user = result.rows[0];
        // Гарантируем отправку чисел, а не строк
        res.json({
            ...user,
            balance: parseFloat(user.balance),
            profit_hr: parseFloat(user.profit_hr)
        });
    } catch (e) { 
        console.error("Fetch Error:", e.message);
        res.status(500).json({ error: "Internal Server Error" }); 
    }
});

// API: Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, profit_hr, lvl } = req.body;

    if (!userId) return res.status(400).json({ error: "No userId" });

    // Очистка данных от NaN и undefined
    const safeBalance = Math.max(0, Math.floor(balance || 0));
    const safeEnergy = Math.max(0, Math.floor(energy || 0));
    const safeProfit = Math.max(0, Math.floor(profit_hr || 0));

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
            [userId, safeBalance, safeEnergy, max_energy || 1000, click_lvl || 1, safeProfit, lvl || 1]
        );
        res.json({ ok: true });
    } catch (e) { 
        console.error("Save Error:", e.message);
        res.status(500).send("Database Save Error"); 
    }
});

// Telegram Bot Logic
bot.start((ctx) => {
    const webAppUrl = "https://neural-pulse.bothost.ru"; // Твой URL
    ctx.replyWithHTML(
        `<b>Neural Pulse v3.8.0 Stable</b>\n\nДобро пожаловать в ядро системы, агент <b>${ctx.from.first_name}</b>!\n\nТвоя задача — добывать импульсы и развивать нейросеть.`, 
        Markup.inlineKeyboard([
            [Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", webAppUrl)],
            [Markup.button.url("📢 Канал проекта", "https://t.me/your_channel")]
        ])
    );
});

// Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
    console.log(`🚀 Neural Server v3.8.0 started on port ${PORT}`); 
    bot.launch().catch(err => console.error("Bot launch failed:", err));
});

// Грациозное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
