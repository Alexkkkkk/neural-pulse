const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// [1] КОНФИГУРАЦИЯ
const BOT_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs";
const DOMAIN = "np.bothost.ru";
const PORT = process.env.PORT || 3000;

// Твоя ссылка на PostgreSQL (Bothost)
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Настройка пула соединений
const pool = new Pool({
    connectionString: PG_URI,
    ssl: { rejectUnauthorized: false } // Важно для стабильного соединения с внешними нодами pghost
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [2] ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0
            );
        `);
        console.log("📦 [DB] PostgreSQL подключена, таблица 'users' активна");
    } catch (err) {
        console.error("❌ [DB] Ошибка инициализации:", err.message);
    }
};
initDB();

// [3] API ЭНДПОИНТЫ

// Получение данных пользователя
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    if (!uid || uid === "null" || uid === "undefined") return res.status(400).json({ error: "Invalid ID" });
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        
        if (result.rows.length === 0) {
            const newUser = await pool.query(
                'INSERT INTO users (user_id) VALUES ($1) RETURNING *', 
                [uid]
            );
            return res.json(newUser.rows[0]);
        }
        
        // PostgreSQL возвращает NUMERIC как строки, конвертируем их для фронтенда
        const user = result.rows[0];
        user.balance = parseFloat(user.balance);
        user.pnl = parseFloat(user.pnl);
        
        res.json(user);
    } catch (e) {
        console.error("❌ [API GET] Ошибка:", e.message);
        res.status(500).json({ error: "DB Read Error" });
    }
});

// Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    const uid = String(userId);

    if (uid && uid !== "undefined" && uid !== "null") {
        try {
            await pool.query(`
                INSERT INTO users (user_id, balance, energy, click_lvl, pnl)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id) DO UPDATE SET
                balance = $2, energy = $3, click_lvl = $4, pnl = $5
            `, [uid, balance || 0, energy || 0, click_lvl || 1, pnl || 0]);
            
            if (Math.random() > 0.9) {
                console.log(`☁️ [DB SAVE] Успешное сохранение в Postgres для: ${uid}`);
            }
            res.json({ status: 'ok' });
        } catch (e) {
            console.error("❌ [DB SAVE] Ошибка сохранения:", e.message);
            res.status(500).json({ error: "Save Error" });
        }
    } else {
        res.status(400).json({ error: 'Invalid User ID' });
    }
});

// [4] ЛОГИКА ТЕЛЕГРАМ-БОТА
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const name = ctx.from.first_name || "Игрок";

    try {
        const result = await pool.query('SELECT balance, energy FROM users WHERE user_id = $1', [uid]);
        
        let userData;
        if (result.rows.length === 0) {
            const newUser = await pool.query('INSERT INTO users (user_id) VALUES ($1) RETURNING *', [uid]);
            userData = newUser.rows[0];
        } else {
            userData = result.rows[0];
        }

        ctx.replyWithHTML(
            `<b>🚀 NEURAL PULSE AI: ОНЛАЙН</b>\n\n` +
            `Привет, ${name}!\n` +
            `Твой баланс: 💰 <b>${Math.floor(Number(userData.balance)).toLocaleString()} NP</b>\n` +
            `Энергия: ⚡ <b>${userData.energy}</b>\n\n` +
            `<i>Данные синхронизированы с PostgreSQL 🐘</i>`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]
            ])
        );
    } catch (e) {
        console.error("❌ [BOT START] Ошибка:", e.message);
        ctx.reply("⚠️ Ошибка доступа к базе данных. Попробуйте позже.");
    }
});

// [5] ЗАПУСК
app.listen(PORT, () => {
    console.log(`\n————————————————————————————————————————————————`);
    console.log(`🖥️  СЕРВЕР: https://${DOMAIN}`);
    console.log(`📦 БАЗА: PostgreSQL (Bothost)`);
    console.log(`————————————————————————————————————————————————\n`);
    
    bot.launch().then(() => {
        console.log(`✅ [BOT] Телеграм бот запущен и готов к работе`);
    }).catch(err => console.error("❌ Ошибка запуска бота:", err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
