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

// Оптимизированный пул подключений
const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false,
    max: 20, // Лимит подключений для pghost
    idleTimeoutMillis: 30000 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
const initDB = async () => {
    console.log("🛠 [DB] Запуск глубокой проверки структуры...");
    try {
        const client = await pool.connect();
        console.log("📡 [DB] Соединение с PostgreSQL установлено");
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY, 
                username TEXT, 
                photo_url TEXT,
                balance DOUBLE PRECISION DEFAULT 0,  
                energy DOUBLE PRECISION DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                tap INTEGER DEFAULT 1, 
                profit INTEGER DEFAULT 0,
                referrer_id BIGINT, -- Добавлено для системы приглашений
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        
        // Индексы для мгновенного ТОПа (критично для больших баз)
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance DESC)`);
        
        console.log("✅ [DB] Таблица users и индексы синхронизированы");
        client.release();
    } catch (e) { 
        console.error("❌ [DB ERROR] Сбой инициализации:", e.message); 
    }
};
initDB();

// --- API: ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url, ref } = req.query; // Принимаем ref из Mini App
    console.log(`📥 [GET] Запрос: ID ${userId} | User: ${username} | Ref: ${ref || 'нет'}`);

    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            console.log(`👤 [DB] Регистрация нового агента: ${userId}`);
            
            // Логика реферала: не записываем самого себя
            const referrer = (ref && ref !== userId) ? ref : null;
            
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url, referrer_id) VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '', referrer]
            );
            return res.json(newUser.rows[0]);
        }
        
        console.log(`✔ [DB] Пользователь ${userId} загружен. Баланс: ${result.rows[0].balance}`);
        res.json(result.rows[0]);
    } catch (e) { 
        console.error(`❌ [API ERROR] Ошибка загрузки пользователя ${userId}:`, e.message);
        res.status(500).json({ error: "DB Error" }); 
    }
});

// --- API: СОХРАНЕНИЕ ПРОГРЕССА ---
app.post('/api/save', async (req, res) => {
    const d = req.body;
    console.log(`📤 [POST] Save: ID ${d.userId} | Balance: ${d.balance} | Energy: ${d.energy}`);

    try {
        // Проверка на фрод (баланс не может быть отрицательным)
        if (d.balance < 0) throw new Error("Negative balance attempt");

        const result = await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [d.userId, d.balance, d.energy, d.tap, d.profit]
        );
        
        if (result.rowCount > 0) {
            res.json({ ok: true });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (e) { 
        console.error(`❌ [API ERROR] Сбой сохранения ${d.userId}:`, e.message);
        res.status(500).json({ error: "Save error" }); 
    }
});

// --- API: ТОП ИГРОКОВ ---
app.get('/api/top', async (req, res) => {
    console.log("🏆 [GET] Формирование ТОП-50");
    try {
        const result = await pool.query('SELECT username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { 
        console.error("❌ [API ERROR] Ошибка ТОПа:", e.message);
        res.status(500).json({ error: "Top error" }); 
    }
});

// --- ТЕЛЕГРАМ БОТ ---
bot.start((ctx) => {
    const refId = ctx.startPayload; // Получаем ID пригласившего
    console.log(`🤖 [BOT] Start: ${ctx.from.id} | RefPayload: ${refId || 'none'}`);
    
    // Формируем ссылку для WebApp с прокидыванием реферала
    const webAppUrl = refId ? `${DOMAIN}?ref=${refId}` : DOMAIN;

    ctx.reply(`<b>Neural Pulse | Sync Active</b>\nWelcome, Agent <b>${ctx.from.first_name}</b>.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", webAppUrl)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    console.log(`\n🚀 ==========================================`);
    console.log(`🚀 СЕРВЕР: ${DOMAIN}`);
    console.log(`🚀 ПОРТ: ${PORT}`);
    console.log(`🚀 БАЗА: PostgreSQL (node1.pghost.ru)`);
    console.log(`🚀 ==========================================\n`);
    
    try {
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        console.log("🔗 [BOT] Webhook OK");
    } catch (e) {
        console.error("❌ [BOT ERROR] Webhook Fail:", e.message);
    }
});
