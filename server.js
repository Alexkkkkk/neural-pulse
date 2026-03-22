const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_db5b342fc026:gwp3jv20PY7JtERt4cNIvSpReq8YpLYzlH99BY5vyc4@node1.pghost.ru:32867/bothost_db_db5b342fc026";
const DOMAIN = "https://neural-pulse.duckdns.org"; 
const PORT = 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- ЛОГИРОВАНИЕ БАЗЫ ДАННЫХ ---
const initDB = async () => {
    console.log("🛠 [DB] Проверка подключения и инициализация таблицы...");
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
        console.log("✅ [DB] Таблица users синхронизирована успешно");
    } catch (e) { 
        console.error("❌ [DB ERROR] Критическая ошибка при инициализации:", e.message); 
    }
};
initDB();

// --- API: ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url } = req.query;
    console.log(`\n📥 [GET] Запрос данных: ID ${userId} | User: ${username}`);

    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            console.log(`👤 [DB] Новый пользователь! Регистрация: ${userId}`);
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url) VALUES ($1, $2, $3) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '']
            );
            return res.json(newUser.rows[0]);
        }
        
        console.log(`✔ [DB] Пользователь найден. Текущий баланс: ${result.rows[0].balance}`);
        res.json(result.rows[0]);
    } catch (e) { 
        console.error(`❌ [API ERROR] Ошибка GET /api/user/${userId}:`, e.message);
        res.status(500).json({ error: "DB Error" }); 
    }
});

// --- API: СОХРАНЕНИЕ ПРОГРЕССА ---
app.post('/api/save', async (req, res) => {
    const d = req.body;
    console.log(`📤 [POST] Сохранение прогресса: ID ${d.userId} | Bal: ${Math.floor(d.balance)} | Eng: ${Math.floor(d.energy)}`);

    try {
        const result = await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [d.userId, d.balance, d.energy, d.tap, d.profit]
        );
        
        if (result.rowCount > 0) {
            res.json({ ok: true });
        } else {
            console.warn(`⚠️ [DB] Попытка сохранения для несуществующего ID: ${d.userId}`);
            res.status(404).json({ error: "User not found" });
        }
    } catch (e) { 
        console.error(`❌ [API ERROR] Ошибка POST /api/save для ${d.userId}:`, e.message);
        res.status(500).json({ error: "Save error" }); 
    }
});

// --- API: ТОП ИГРОКОВ ---
app.get('/api/top', async (req, res) => {
    console.log("🏆 [GET] Запрос таблицы лидеров");
    try {
        const result = await pool.query('SELECT id, username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        console.log(`📊 [DB] Топ сформирован. Найдено участников: ${result.rowCount}`);
        res.json(result.rows);
    } catch (e) { 
        console.error("❌ [API ERROR] Ошибка при получении ТОПа:", e.message);
        res.status(500).json({ error: "Top error" }); 
    }
});

// --- ТЕЛЕГРАМ БОТ ---
bot.start((ctx) => {
    console.log(`🤖 [BOT] Команда /start от ${ctx.from.id} (@${ctx.from.username})`);
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
    console.log(`🚀 ==========================================`);
    
    try {
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        console.log("🔗 [BOT] Webhook успешно установлен");
    } catch (e) {
        console.error("❌ [BOT ERROR] Не удалось установить Webhook:", e.message);
    }
});
