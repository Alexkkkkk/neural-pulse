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

// --- ЖЕСТКАЯ ИНИЦИАЛИЗАЦИЯ БД ---
const initDB = async () => {
    console.log("🛠 [DB] Принудительная проверка структуры...");
    try {
        // Проверяем наличие колонки 'id'
        const checkRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'id'
        `);

        // Если таблицы нет или в ней нет колонки 'id' — пересоздаем всё через CASCADE
        if (checkRes.rowCount === 0) {
            console.log("⚠️ [DB] Структура устарела. Выполняю DROP TABLE ... CASCADE");
            await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
        }

        // Создаем чистую таблицу с правильными именами
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
        console.log("✅ [DB] Таблица users успешно инициализирована");
    } catch (e) { 
        console.error("❌ [DB ERROR] Ошибка принудительной очистки:", e.message); 
    }
};
initDB();

// --- API: ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url } = req.query;
    console.log(`\n📥 [GET] Запрос: ID ${userId}`);

    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            console.log(`👤 [DB] Регистрация нового юзера: ${userId}`);
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url) VALUES ($1, $2, $3) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '']
            );
            return res.json(newUser.rows[0]);
        }
        
        console.log(`✔ [DB] Юзер найден. Bal: ${result.rows[0].balance}`);
        res.json(result.rows[0]);
    } catch (e) { 
        console.error(`❌ [API ERROR] GET /api/user/${userId}:`, e.message);
        res.status(500).json({ error: "DB Read Error" }); 
    }
});

// --- API: СОХРАНЕНИЕ ---
app.post('/api/save', async (req, res) => {
    const d = req.body;
    console.log(`📤 [POST] Сохранение: ID ${d.userId} | Bal: ${d.balance}`);

    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [d.userId, d.balance, d.energy, d.tap, d.profit]
        );
        res.json({ ok: true });
    } catch (e) { 
        console.error(`❌ [API ERROR] Save Fail для ${d.userId}:`, e.message);
        res.status(500).json({ error: "Save error" }); 
    }
});

// --- API: ТОП 50 ---
app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { 
        res.status(500).json({ error: "Top error" }); 
    }
});

// --- БОТ ---
bot.start((ctx) => {
    ctx.reply(`<b>Neural Pulse | Syncing...</b>\nWelcome back, Agent <b>${ctx.from.first_name}</b>.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", DOMAIN)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    console.log(`🚀 SERVER START: ${DOMAIN}`);
    await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
});
