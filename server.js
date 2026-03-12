const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// [1] КОНФИГУРАЦИЯ
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const pool = new Pool({
    connectionString: PG_URI,
    ssl: false 
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [2] ИНИЦИАЛИЗАЦИЯ БАЗЫ
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
                wallet TEXT,
                last_seen BIGINT DEFAULT extract(epoch from now())
            );
        `);
        // Проверка наличия колонки wallet (для обновлений)
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet TEXT;`);
        console.log("📦 [DB] PostgreSQL подключена. Структура проверена.");
    } catch (err) {
        console.error("❌ [DB] Ошибка инициализации:", err.message);
    }
};
initDB();

// [3] API ЭНДПОИНТЫ

// Загрузка данных
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
        const secondsOffline = Math.max(0, now - lastSeen);
        
        user.balance = Number(user.balance) || 0;
        user.energy = parseInt(user.energy) || 1000;
        user.pnl = Number(user.pnl) || 0;
        user.click_lvl = parseInt(user.click_lvl) || 1;

        if (secondsOffline > 0) {
            if (user.pnl > 0) user.balance += (secondsOffline * user.pnl) / 3600;
            if (user.energy < 1000) user.energy = Math.min(1000, user.energy + Math.floor(secondsOffline * 1.5));
            
            await pool.query(
                'UPDATE users SET balance = $1, energy = $2, last_seen = $3 WHERE user_id = $4',
                [user.balance, user.energy, now, uid]
            );
        }
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: "DB Read Error" });
    }
});

// Сохранение данных (включая кошелек)
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl, username, wallet } = req.body;
    const uid = String(userId);

    if (uid && uid !== "undefined" && uid !== "null") {
        try {
            await pool.query(`
                INSERT INTO users (user_id, balance, energy, click_lvl, pnl, username, wallet, last_seen)
                VALUES ($1, $2, $3, $4, $5, $6, $7, extract(epoch from now()))
                ON CONFLICT (user_id) DO UPDATE SET
                balance = EXCLUDED.balance, energy = EXCLUDED.energy, 
                click_lvl = EXCLUDED.click_lvl, pnl = EXCLUDED.pnl, 
                username = EXCLUDED.username, wallet = EXCLUDED.wallet,
                last_seen = extract(epoch from now())
            `, [uid, Number(balance), Math.floor(Number(energy)), parseInt(click_lvl), Number(pnl), username, wallet]);
            res.json({ status: 'ok' });
        } catch (e) {
            res.status(500).json({ error: "Save Error" });
        }
    } else {
        res.status(400).json({ error: "Invalid User ID" });
    }
});

// [4] ЛОГИКА БОТА
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const name = ctx.from.username || ctx.from.first_name || "Игрок";
    try {
        await pool.query(`INSERT INTO users (user_id, username) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET username = $2`, [uid, name]);
        const gameUrl = `https://${DOMAIN}?v=${Date.now()}`;
        ctx.replyWithHTML(`<b>🚀 NEURAL PULSE AI</b>\n\nПривет, ${name}!\nДобро пожаловать в систему.`, 
            Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', gameUrl)]])
        );
    } catch (e) { ctx.reply("⚠️ Ошибка базы."); }
});

bot.command('top', async (ctx) => {
    try {
        const result = await pool.query('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 10');
        let msg = "<b>🏆 ТОП-10 МАЙНЕРОВ</b>\n\n";
        result.rows.forEach((u, i) => msg += `${i+1}. <b>${u.username || 'Anon'}</b> — ${Math.floor(u.balance).toLocaleString()} NP\n`);
        ctx.replyWithHTML(msg);
    } catch (e) { ctx.reply("❌ Ошибка топа."); }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    bot.launch();
});
