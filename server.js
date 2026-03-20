const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "https://neural-pulse.bothost.ru"; 
const PORT = 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- ПОСТРОЧНОЕ ЛОГИРОВАНИЕ БАЗЫ ДАННЫХ ---
const initDB = async () => {
    console.log("🛠 [DB] Попытка инициализации таблицы...");
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY, 
                username TEXT, 
                photo_url TEXT,
                balance DOUBLE PRECISION DEFAULT 0,  
                energy DOUBLE PRECISION DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                tap INTEGER DEFAULT 1, 
                profit INTEGER DEFAULT 0,  
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("✅ [DB] Таблица users готова к работе");
    } catch (e) { 
        console.error("❌ [DB ERROR] Ошибка при создании таблицы:", e.message); 
    }
};
initDB();

// --- API: ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url } = req.query;
    console.log(`\n📥 [GET] Запрос данных пользователя: ID ${userId} (${username})`);

    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            console.log(`👤 [DB] Новый пользователь! Создаю запись для ${userId}...`);
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url) VALUES ($1, $2, $3) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '']
            );
            console.log(`✨ [DB] Пользователь ${userId} успешно создан.`);
            return res.json(newUser.rows[0]);
        }
        
        console.log(`✔ [DB] Данные для ${userId} найдены. Баланс: ${result.rows[0].balance}`);
        res.json(result.rows[0]);
    } catch (e) { 
        console.error(`❌ [API ERROR] Ошибка GET /api/user/${userId}:`, e.message);
        res.status(500).json({ error: "DB Read Error" }); 
    }
});

// --- API: СОХРАНЕНИЕ ПРОГРЕССА ---
app.post('/api/save', async (req, res) => {
    const d = req.body;
    // Логируем только важные изменения, чтобы не спамить консоль каждые 10 секунд слишком сильно
    console.log(`📤 [POST] Сохранение: ID ${d.userId} | Bal: ${Math.floor(d.balance)} | Eng: ${Math.floor(d.energy)}`);

    try {
        const result = await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [d.userId, d.balance, d.energy, d.tap, d.profit]
        );
        
        if (result.rowCount > 0) {
            res.json({ ok: true });
        } else {
            console.warn(`⚠️ [DB] Предупреждение: ID ${d.userId} не найден при сохранении.`);
            res.status(404).json({ error: "User not found" });
        }
    } catch (e) { 
        console.error(`❌ [API ERROR] Ошибка POST /api/save для ${d.userId}:`, e.message);
        res.status(500).json({ error: "Save error" }); 
    }
});

// --- API: ТОП 50 ---
app.get('/api/top', async (req, res) => {
    console.log("🏆 [GET] Запрос таблицы лидеров");
    try {
        const result = await pool.query('SELECT id, username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        console.log(`📊 [DB] Топ-лист сформирован. Всего участников: ${result.rowCount}`);
        res.json(result.rows);
    } catch (e) { 
        console.error("❌ [API ERROR] Ошибка при получении ТОПа:", e.message);
        res.status(500).json({ error: "Top error" }); 
    }
});

// --- ЛОГИРОВАНИЕ БОТА ---
bot.start((ctx) => {
    console.log(`🤖 [BOT] Команда /start от ${ctx.from.username || ctx.from.id}`);
    ctx.reply(`<b>Neural Pulse | Sync Active</b>\nWelcome, Agent <b>${ctx.from.first_name}</b>.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", DOMAIN)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    console.log(`\n🚀 ==========================================`);
    console.log(`🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ: ${PORT}`);
    console.log(`🚀 ДОМЕН: ${DOMAIN}`);
    console.log(`🚀 ==========================================\n`);
    
    try {
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        console.log("🔗 [BOT] Webhook успешно установлен");
    } catch (e) {
        console.error("❌ [BOT ERROR] Ошибка установки Webhook:", e.message);
    }
});
