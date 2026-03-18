const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

// Конфигурация
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Настройка пула БД (добавлена обработка SSL для облачных хостингов)
const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: { rejectUnauthorized: false } // Позволяет подключаться к большинству облачных БД
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Инициализация базы данных
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
                lvl INTEGER DEFAULT 1,
                likes INTEGER DEFAULT 0,
                is_liked BOOLEAN DEFAULT FALSE,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        
        // Проверка наличия колонок (на случай обновления старой таблицы)
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        
        console.log("✅ [DB] База данных проверена и готова.");
    } catch (e) { 
        console.error("❌ [DB INIT ERROR]", e.message); 
    }
};
initDB();

// API: Получение данных пользователя + Расчет офлайн дохода
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

        let user = result.rows[0];
        
        // --- ЛОГИКА ОФЛАЙН ДОХОДА ---
        if (user.profit_hr > 0) {
            const now = new Date();
            const lastSeen = new Date(user.last_seen);
            const secondsOffline = Math.floor((now - lastSeen) / 1000);
            
            if (secondsOffline > 60) { // Начисляем, если не было хотя бы минуту
                const offlineProfit = (user.profit_hr / 3600) * secondsOffline;
                user.balance = parseFloat(user.balance) + offlineProfit;
                console.log(`💰 [OFFLINE] Игрок ${userId} отсутствовал ${secondsOffline} сек. Начислено: ${offlineProfit.toFixed(2)}`);
                
                // Сразу обновляем в базе
                await pool.query('UPDATE users SET balance = $1, last_seen = CURRENT_TIMESTAMP WHERE user_id = $2', [user.balance, userId]);
            }
        }

        res.json(user);
    } catch (e) { 
        console.error("❌ [GET USER ERROR]", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// API: Сохранение данных
app.post('/api/save', async (req, res) => {
    const d = req.body;
    // Логируем как в твоем скриншоте
    console.log(`📥 [SAVE] Пытаемся сохранить ID: ${d.userId}, Баланс: ${d.balance}`);
    
    try {
        const result = await pool.query(`
            UPDATE users SET 
                balance = $2, energy = $3, max_energy = $4, 
                click_lvl = $5, profit_hr = $6, lvl = $7, 
                likes = $8, is_liked = $9,
                last_seen = CURRENT_TIMESTAMP 
            WHERE user_id = $1`, 
            [d.userId, d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl, d.likes || 0, d.is_liked || false]
        );
        
        if (result.rowCount > 0) {
            console.log(`✅ [SAVE] Данные ID: ${d.userId} обновлены.`);
            res.json({ ok: true });
        } else {
            res.json({ ok: false, error: "not_found" });
        }
    } catch (e) { 
        console.error("❌ [SAVE ERROR]", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// Телеграм бот
bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v4.0.0</b>\nДобро пожаловать, ${ctx.from.first_name}!`, 
        Markup.inlineKeyboard([
            [Markup.button.webApp("⚡ ЗАПУСТИТЬ", "https://neural-pulse.bothost.ru")]
        ]));
});

// Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
    console.log(`🚀 [SERVER] Запущен на порту ${PORT}`);
    bot.launch().then(() => console.log("🤖 [BOT] Телеграм бот запущен."));
});

// Мягкая остановка
process.once('SIGINT', () => { bot.stop('SIGINT'); pool.end(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); pool.end(); });
