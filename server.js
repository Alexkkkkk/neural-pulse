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

const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;

// --- ИНИЦИАЛИЗАЦИЯ БД ---
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
                wallet TEXT,
                photo_url TEXT, 
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("✅ [DB] Connected and Ready");
    } catch (e) { console.error("❌ [DB ERROR]:", e.message); }
};
initDB();

// --- API ЭНДПОИНТЫ ---

// Получение или создание пользователя
app.get('/api/user/:id', async (req, res) => {
    const userId = String(req.params.id);
    const username = req.query.username || 'Agent';
    const photoUrl = req.query.photo_url || null; 
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username, photo_url) VALUES ($1, $2, $3)', [userId, username, photoUrl]);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        } else {
            // Обновляем имя и фото при каждом входе
            await pool.query('UPDATE users SET username = $2, photo_url = $3, last_seen = NOW() WHERE user_id = $1', [userId, username, photoUrl]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// Сохранение состояния игры
app.post('/api/save', async (req, res) => {
    const d = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, profit_hr=$6, lvl=$7 WHERE user_id=$1`, 
            [String(d.userId), d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save error" }); }
});

// Сохранение кошелька
app.post('/api/wallet', async (req, res) => {
    const { userId, address } = req.body;
    try {
        await pool.query('UPDATE users SET wallet = $2 WHERE user_id = $1', [String(userId), address]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Wallet error" }); }
});

// Лидерборд
app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: "Top error" }); }
});

// Бот Старт
bot.start((ctx) => {
    const welcome = `<b>Neural Pulse | Synchronization Initialized</b>\n\nWelcome, Agent <b>${ctx.from.first_name}</b>. Access the neural network via the button below.`;
    ctx.reply(welcome, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В СИСТЕМУ", DOMAIN)]])
    });
});

// Запуск
app.use(bot.webhookCallback(WEBHOOK_PATH));
app.listen(PORT, async () => {
    console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
    await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
});
