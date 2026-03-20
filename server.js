const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

// --- КОНФИГУРАЦИЯ ---
// ТОКЕН ВАШЕГО БОТА (получить у @BotFather)
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
// СТРОКА ПОДКЛЮЧЕНИЯ К ПОСТГРЕСУ (выдается хостингом)
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
// ДОМЕН ВАШЕГО ПРИЛОЖЕНИЯ (https://...)
const DOMAIN = "https://neural-pulse.bothost.ru"; 
const PORT = 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Подключение к БД
const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false // ВАЖНО: ssl: false для Bothost
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Middleware для логирования HTTP запросов
app.use((req, res, next) => {
    const now = new Date().toISOString().slice(11, 19);
    if (!req.url.includes('telegraf')) { // Не спамим логами вебхука
        console.log(`[${now}] 📡 ${req.method} ${req.url}`);
    }
    next();
});

// Настройка Webhook пути (секретный путь на базе токена)
const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
const initDB = async () => {
    console.log("🛠 [DB] Connecting and checking tables...");
    try {
        // Добавлено поле photo_url TEXT
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
        console.log("✅ [DB] Database is Ready (photo_url column checked)");
    } catch (e) { 
        console.error("❌ [DB ERROR] Initial setup failed:", e.message); 
    }
};
initDB();

// --- API ЭНДПОИНТЫ ---

// Получение/Создание юзера. Принимает id, username и photo_url
app.get('/api/user/:id', async (req, res) => {
    const userId = String(req.params.id);
    const username = req.query.username || 'Agent';
    const photoUrl = req.query.photo_url || null; // Получаем фото из запроса
    
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        
        if (result.rows.length === 0) {
            console.log(`🆕 [DB] Creating user: ${username} (${userId})`);
            // Сохраняем и фото при создании
            await pool.query(
                'INSERT INTO users (user_id, username, photo_url) VALUES ($1, $2, $3)', 
                [userId, username, photoUrl]
            );
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        } else {
            // Обновляем имя, фото и время последнего входа
            console.log(`📝 [DB] Updating info for: ${username}`);
            await pool.query(
                'UPDATE users SET username = $2, photo_url = $3, last_seen = NOW() WHERE user_id = $1', 
                [userId, username, photoUrl]
            );
        }
        res.json(result.rows[0]);
    } catch (e) { 
        console.error(`❌ [API ERROR] User ${userId}:`, e.message);
        res.status(500).json({ error: "Database communication error" }); 
    }
});

// Сохранение прогресса тапов и апгрейдов
app.post('/api/save', async (req, res) => {
    const d = req.body;
    if (!d.userId) return res.status(400).json({ error: "No userId" });

    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, profit_hr=$6, lvl=$7 WHERE user_id=$1`, 
            [String(d.userId), d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl]
        );
        res.json({ ok: true });
    } catch (e) { 
        console.error(`❌ [API ERROR] Save failed for ${d.userId}:`, e.message);
        res.status(500).json({ error: "Database save error" }); 
    }
});

// Глобальный ТОП (возвращает и photo_url)
app.get('/api/top', async (req, res) => {
    try {
        // Добавлен photo_url в выборку
        const result = await pool.query(
            'SELECT user_id, username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50'
        );
        res.json(result.rows);
    } catch (e) { 
        console.error("❌ [API ERROR] Top fetch failed:", e.message);
        res.status(500).json({ error: "Database leaderboard error" }); 
    }
});

// Сохранение адреса кошелька (для секции WALLET)
app.post('/api/wallet', async (req, res) => {
    const { userId, address } = req.body;
    try {
        await pool.query('UPDATE users SET wallet = $2 WHERE user_id = $1', [String(userId), address]);
        res.json({ ok: true });
    } catch (e) { 
        console.error(`❌ [API ERROR] Wallet update for ${userId}:`, e.message);
        res.status(500).json({ error: "Database wallet error" }); 
    }
});

// --- ЛОГИКА ТЕЛЕГРАМ БОТА ---

bot.start((ctx) => {
    const from = ctx.from;
    console.log(`🤖 [BOT] Start: ${from.first_name} (@${from.username || 'none'})`);
    
    // Получаем URL статического логотипа для оформления
    const logoUrl = `${DOMAIN}/images/logo.png`;

    ctx.replyWithPhoto(
        { url: logoUrl }, // Отправляем логотип Neural Pulse
        {
            caption: `<b>Neural Pulse | Synchronization Initialized</b>\n\nWelcome, Agent <b>${from.first_name}</b>.\nВаш терминал готов к работе.\n\nНажмите кнопку ниже, чтобы начать майнинг и синхронизироваться с сетью.`,
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", DOMAIN)]
            ])
        }
    );
});

// Глобальный перехватчик ошибок бота
bot.catch((err, ctx) => {
    console.error(`❌ [TELEGRAF ERROR] Update ${ctx.updateType}:`, err);
});

// --- ЗАПУСК СЕРВЕРА И УСТАНОВКА WEBHOOK ---

app.listen(PORT, async () => {
    console.log(`\n---------------------------------`);
    console.log(`🚀 NEURAL SERVER STARTED ON PORT ${PORT}`);
    console.log(`🌍 Domain: ${DOMAIN}`);
    
    try {
        console.log(`📡 [WEBHOOK] Connecting to Telegram...`);
        // Устанавливаем вебхук в Telegram (говорим ему, куда слать POST запросы)
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        const info = await bot.telegram.getWebhookInfo();
        console.log(`✅ [WEBHOOK] Telegram link established! Pending: ${info.pending_update_count}`);
        console.log(`📝 [WEBHOOK] URL: ${info.url}`);
        console.log(`---------------------------------\n`);
    } catch (e) {
        console.error(`❌ [WEBHOOK ERROR] Set webhook failed:`, e.message);
    }
});

// Обработка плавного выключения
process.once('SIGINT', () => { 
    console.log("🛑 SIGINT received. Shutting down pool...");
    pool.end(); 
});
process.once('SIGTERM', () => { 
    console.log("🛑 SIGTERM received. Shutting down pool...");
    pool.end(); 
});
