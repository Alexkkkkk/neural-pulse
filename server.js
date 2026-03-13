const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// --- КОНФИГУРАЦИЯ ---
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- ПОДКЛЮЧЕНИЕ К БД ---
const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false 
});

// Парсинг числовых значений (NUMERIC -> Float)
const types = require('pg').types;
types.setTypeParser(1700, val => parseFloat(val));

app.use(cors());
app.use(express.json());
// Указываем папку static для раздачи фронтенда
app.use(express.static(path.join(__dirname, 'static')));

// --- МАТЕМАТИКА ---
const MATH = {
    CLICK_BASE: 500,
    CLICK_GROWTH: 1.45,
    PNL_BASE: 1200,
    PNL_GROWTH: 1.28,
    PNL_STEP: 250
};

const getClickCost = (lvl) => Math.floor(MATH.CLICK_BASE * Math.pow(MATH.CLICK_GROWTH, lvl - 1));
const getPnlCost = (pnl) => Math.floor(MATH.PNL_BASE * Math.pow(MATH.PNL_GROWTH, Math.floor(pnl / MATH.PNL_STEP)));

// --- ИНИЦИАЛИЗАЦИЯ БД ---
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
                referrer_id TEXT,
                last_seen BIGINT DEFAULT extract(epoch from now()),
                last_save BIGINT DEFAULT extract(epoch from now())
            );
            CREATE INDEX IF NOT EXISTS idx_balance ON users (balance DESC);
        `);
        console.log("✅ [DB] Система готова.");
    } catch (err) { console.error("❌ [DB] Ошибка:", err.message); }
};
initDB();

// --- API МАРШРУТЫ ---

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// Получение данных и офлайн доход
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const refBy = req.query.ref;
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (result.rows.length === 0) {
            const refId = (refBy && refBy !== uid) ? String(refBy) : null;
            await pool.query('INSERT INTO users (user_id, referrer_id, last_seen, last_save) VALUES ($1, $2, extract(epoch from now()), extract(epoch from now()))', [uid, refId]);
            if (refId) await pool.query('UPDATE users SET balance = balance + 5000 WHERE user_id IN ($1, $2)', [uid, refId]);
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }

        let user = result.rows[0];
        const now = Math.floor(Date.now() / 1000);
        const diff = now - parseInt(user.last_seen);

        if (diff > 60 && parseFloat(user.pnl) > 0) {
            const hours = Math.min(diff, 14400) / 3600;
            user.balance = parseFloat(user.balance) + (parseFloat(user.pnl) * hours);
            user.energy = Math.min(1000, user.energy + (diff * 1.5));
            user.last_seen = now;
            await pool.query('UPDATE users SET balance=$1, energy=$2, last_seen=$3 WHERE user_id=$4', [user.balance, Math.floor(user.energy), now, uid]);
        }
        res.json(user);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// Сохранение (Анти-чит)
app.post('/api/save', async (req, res) => {
    const { userId, clicks, energy, username } = req.body;
    const now = Math.floor(Date.now() / 1000);
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)]);
        if (userRes.rows.length === 0) return res.status(404).json({error: "Not found"});
        
        const user = userRes.rows[0];
        const timeDiff = Math.max(now - parseInt(user.last_save), 1);
        const finalClicks = Math.min(clicks || 0, timeDiff * 15);
        const newBalance = parseFloat(user.balance) + (finalClicks * parseInt(user.click_lvl));

        await pool.query('UPDATE users SET balance=$1, energy=$2, username=$3, last_save=$4, last_seen=$4 WHERE user_id=$5', 
            [newBalance, Math.floor(energy), username || 'Player', now, String(userId)]);
        res.json({ status: 'ok', balance: newBalance });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Апгрейды
app.post('/api/upgrade', async (req, res) => {
    const { userId, type } = req.body;
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)]);
        const user = userRes.rows[0];
        if (!user) return res.json({ success: false });

        let cost = type === 'click' ? getClickCost(user.click_lvl) : getPnlCost(user.pnl);
        if (parseFloat(user.balance) >= cost) {
            const query = type === 'click' 
                ? 'UPDATE users SET balance=balance-$1, click_lvl=click_lvl+1 WHERE user_id=$2'
                : `UPDATE users SET balance=balance-$1, pnl=pnl+${MATH.PNL_STEP} WHERE user_id=$2`;
            await pool.query(query, [cost, String(userId)]);
            return res.json({ success: true });
        }
        res.json({ success: false, error: "Low balance" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Бот
bot.start((ctx) => {
    const gameUrl = `https://${DOMAIN}?u=${ctx.from.id}${ctx.payload ? '&ref=' + ctx.payload : ''}&v=${Date.now()}`;
    ctx.replyWithHTML(`<b>🧠 NEURAL PULSE AI</b>\n\nПривет, <b>${ctx.from.first_name}</b>!`, 
        Markup.inlineKeyboard([[Markup.button.webApp('⚡ ЗАПУСТИТЬ ТЕРМИНАЛ', gameUrl)]]));
});

app.listen(PORT, () => {
    bot.launch().catch(err => console.error("Bot failed:", err));
    console.log(`🚀 Сервер на порту ${PORT}`);
});
