require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// ДАННЫЕ ИЗ ТВОИХ СКРИНШОТОВ
const BOT_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs";
const DOMAIN = "neural-pulse.bothost.ru";
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

// Инициализация базы данных
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
        console.log("✅ [DATABASE] Таблица создана или уже существует");
    } catch (err) {
        console.error("❌ [DATABASE] Ошибка инициализации:", err.message);
    }
};
initDB();

// Манифест для TON Connect
app.get('/tonconnect-manifest.json', (req, res) => {
    res.json({
        "url": `https://${DOMAIN}`,
        "name": "Neural Pulse AI",
        "iconUrl": `https://${DOMAIN}/logo.png`
    });
});

// API: Получение данных пользователя
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    if (!uid || uid === "null") return res.status(400).json({ error: "Invalid ID" });
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (result.rows.length === 0) {
            const newUser = await pool.query(
                'INSERT INTO users (user_id) VALUES ($1) RETURNING *', [uid]
            );
            return res.json(newUser.rows[0]);
        }
        
        let user = result.rows[0];
        const now = Math.floor(Date.now() / 1000);
        const lastSeen = parseInt(user.last_seen) || now;
        const secondsOffline = Math.max(0, now - lastSeen);
        
        // Расчет пассивного дохода за время отсутствия
        if (secondsOffline > 0 && user.pnl > 0) {
            user.balance = Number(user.balance) + (secondsOffline * (Number(user.pnl) / 3600));
            user.energy = Math.min(1000, (user.energy || 1000) + Math.floor(secondsOffline * 1.5));
        }
        
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// API: Сохранение данных
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl, username, wallet } = req.body;
    try {
        await pool.query(`
            INSERT INTO users (user_id, balance, energy, click_lvl, pnl, username, wallet, last_seen)
            VALUES ($1, $2, $3, $4, $5, $6, $7, extract(epoch from now()))
            ON CONFLICT (user_id) DO UPDATE SET
            balance = EXCLUDED.balance, energy = EXCLUDED.energy, click_lvl = EXCLUDED.click_lvl, 
            pnl = EXCLUDED.pnl, username = EXCLUDED.username, wallet = EXCLUDED.wallet,
            last_seen = extract(epoch from now())
        `, [String(userId), balance, energy, click_lvl, pnl, username, wallet]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Команда /start в Telegram
bot.start((ctx) => {
    const gameUrl = `https://${DOMAIN}?u=${ctx.from.id}`;
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE AI</b>\n\nДобро пожаловать в систему майнинга. Нажми кнопку ниже, чтобы начать!`, 
        Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', gameUrl)]])
    );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`📡 [SERVER] Опубликован на https://${DOMAIN}`);
    bot.launch();
});
