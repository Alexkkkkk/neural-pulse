const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// [1] КОНФИГУРАЦИЯ
const BOT_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs";
const DOMAIN = "np.bothost.ru";
const PORT = process.env.PORT || 3000;
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const pool = new Pool({
    connectionString: PG_URI,
    ssl: false // Обязательно false для внутренней сети Bothost
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [2] УМНАЯ ИНИЦИАЛИЗАЦИЯ БАЗЫ
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                pnl NUMERIC DEFAULT 0,
                last_seen BIGINT DEFAULT extract(epoch from now())
            );
        `);

        // Проверка наличия колонок
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen BIGINT DEFAULT extract(epoch from now());`);

        console.log("📦 [DB] PostgreSQL подключена. Структура проверена.");
    } catch (err) {
        console.error("❌ [DB] Ошибка инициализации:", err.message);
    }
};
initDB();

// [3] API ЭНДПОИНТЫ

// Загрузка данных пользователя
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    if (!uid || uid === "null" || uid === "undefined") return res.status(400).json({ error: "Invalid ID" });
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        
        if (result.rows.length === 0) {
            const newUser = await pool.query(
                'INSERT INTO users (user_id, last_seen) VALUES ($1, extract(epoch from now())) RETURNING *', 
                [uid]
            );
            return res.json(newUser.rows[0]);
        }
        
        let user = result.rows[0];
        const now = Math.floor(Date.now() / 1000);
        const lastSeen = parseInt(user.last_seen) || now;
        const secondsOffline = Math.max(0, now - lastSeen); // Защита от отрицательных чисел
        
        user.balance = parseFloat(user.balance) || 0;
        user.energy = parseInt(user.energy) || 1000;
        user.pnl = parseFloat(user.pnl) || 0;

        let needsDbUpdate = false;

        // 1. Начисляем оффлайн доход
        if (secondsOffline > 0 && user.pnl > 0) {
            const bonus = (secondsOffline * user.pnl) / 3600;
            user.balance += bonus;
            needsDbUpdate = true;
        }

        // 2. Восстанавливаем энергию оффлайн (1.5 в секунду)
        if (secondsOffline > 0 && user.energy < 1000) {
            const energyRestored = Math.floor(secondsOffline * 1.5);
            user.energy = Math.min(1000, user.energy + energyRestored);
            needsDbUpdate = true;
        }

        // 3. Мгновенно сохраняем оффлайн прогресс, чтобы он не потерялся!
        if (needsDbUpdate) {
            await pool.query(
                'UPDATE users SET balance = $1, energy = $2, last_seen = $3 WHERE user_id = $4',
                [user.balance, user.energy, now, uid]
            );
        }
        
        res.json(user);
    } catch (e) {
        console.error("❌ [API GET] Ошибка:", e.message);
        res.status(500).json({ error: "DB Read Error" });
    }
});

// Сохранение данных
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl, username } = req.body;
    const uid = String(userId);

    if (uid && uid !== "undefined" && uid !== "null") {
        try {
            await pool.query(`
                INSERT INTO users (user_id, balance, energy, click_lvl, pnl, username, last_seen)
                VALUES ($1, $2, $3, $4, $5, $6, extract(epoch from now()))
                ON CONFLICT (user_id) DO UPDATE SET
                balance = EXCLUDED.balance, 
                energy = EXCLUDED.energy, 
                click_lvl = EXCLUDED.click_lvl, 
                pnl = EXCLUDED.pnl, 
                username = EXCLUDED.username, 
                last_seen = extract(epoch from now())
            `, [uid, balance, energy, click_lvl, pnl, username]);
            
            res.json({ status: 'ok' });
        } catch (e) {
            console.error("❌ [API SAVE] Ошибка:", e.message);
            res.status(500).json({ error: "Save Error" });
        }
    } else {
        res.status(400).json({ error: "Invalid User ID" });
    }
});

// [4] ЛОГИКА ТЕЛЕГРАМ-БОТА

bot.command('top', async (ctx) => {
    try {
        const result = await pool.query('SELECT username, balance, user_id FROM users ORDER BY balance DESC LIMIT 10');
        let message = "<b>🏆 ТОП-10 МАЙНЕРОВ NEURAL PULSE</b>\n\n";
        
        if (result.rows.length === 0) {
            message += "<i>Пока никого нет... Стань первым!</i>";
        } else {
            result.rows.forEach((user, index) => {
                const name = user.username || `ID: ${String(user.user_id).slice(0,4)}...`;
                const bal = Math.floor(parseFloat(user.balance)).toLocaleString();
                message += `${index + 1}. <b>${name}</b> — ${bal} NP\n`;
            });
        }
        
        ctx.replyWithHTML(message);
    } catch (e) {
        console.error("❌ [TOP] Ошибка:", e.message);
        ctx.reply("❌ Не удалось загрузить таблицу лидеров.");
    }
});

bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const name = ctx.from.username || ctx.from.first_name || "Игрок";

    try {
        await pool.query(`
            INSERT INTO users (user_id, username) 
            VALUES ($1, $2) 
            ON CONFLICT (user_id) DO UPDATE SET username = $2
        `, [uid, name]);
        
        const result = await pool.query('SELECT balance FROM users WHERE user_id = $1', [uid]);
        const bal = parseFloat(result.rows[0]?.balance) || 0;

        ctx.replyWithHTML(
            `<b>🚀 NEURAL PULSE AI</b>\n\n` +
            `Привет, ${name}!\n` +
            `Твой баланс: 💰 <b>${Math.floor(bal).toLocaleString()} NP</b>\n\n` +
            `Используй /top чтобы увидеть лидеров!`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]
            ])
        );
    } catch (e) {
        console.error("❌ [START] Ошибка:", e.message);
        ctx.reply("⚠️ Ошибка связи с базой данных.");
    }
});

// [5] ЗАПУСК СЕРВЕРА
app.listen(PORT, () => {
    console.log(`\n————————————————————————————————————————————————`);
    console.log(`🖥️  СЕРВЕР: https://${DOMAIN}`);
    console.log(`📦 БАЗА: PostgreSQL ПОДКЛЮЧЕНА`);
    console.log(`————————————————————————————————————————————————\n`);
    bot.launch().then(() => {
        console.log(`✅ [BOT] Бот успешно запущен`);
    }).catch(err => console.error("❌ Ошибка бота:", err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
