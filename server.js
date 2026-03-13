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

const ADMIN_ID = 123456789; // Замени на свой ID
const WEB_ADMIN_PASSWORD = "1234"; // Пароль для админки в приложении

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Настройка пула с SSL для работы на облачных хостингах
const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: { rejectUnauthorized: false } 
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- МАТЕМАТИКА ИГРЫ ---
const MATH = {
    CLICK_BASE: 500,
    CLICK_GROWTH: 1.45,
    PNL_BASE: 1200,
    PNL_GROWTH: 1.28,
    PNL_STEP: 250
};

const getClickCost = (lvl) => Math.floor(MATH.CLICK_BASE * Math.pow(MATH.CLICK_GROWTH, lvl - 1));
const getPnlCost = (pnl) => {
    const pnlLvl = Math.floor(pnl / MATH.PNL_STEP);
    return Math.floor(MATH.PNL_BASE * Math.pow(MATH.PNL_GROWTH, pnlLvl));
};

// Инициализация БД
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
        `);
        console.log("✅ [DB] Таблицы готовы.");
    } catch (err) { console.error("❌ [DB] Ошибка:", err.message); }
};
initDB();

// --- API ЭНДПОИНТЫ ---

// 1. Данные пользователя
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const refBy = req.query.ref;
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, referrer_id, last_seen) VALUES ($1, $2, extract(epoch from now()))', [uid, refBy]);
            if (refBy && refBy !== uid) {
                await pool.query('UPDATE users SET balance = balance + 5000 WHERE user_id IN ($1, $2)', [uid, refBy]);
            }
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        let user = result.rows[0];
        const now = Math.floor(Date.now() / 1000);
        const diff = now - parseInt(user.last_seen);

        if (diff > 30) {
            const hours = Math.min(diff, 14400) / 3600;
            const passiveIncome = parseFloat(user.pnl) * hours;
            const energyRegen = diff * 1.5;
            user.balance = parseFloat(user.balance) + passiveIncome;
            user.energy = Math.min(1000, parseFloat(user.energy) + energyRegen);
            user.last_seen = now;
            await pool.query('UPDATE users SET balance=$1, energy=$2, last_seen=$3 WHERE user_id=$4', [user.balance, Math.floor(user.energy), user.last_seen, uid]);
        }
        res.json(user);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// 2. Топ игроков (для страницы STATS)
app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 10');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: "Top Error" }); }
});

// 3. Сохранение
app.post('/api/save', async (req, res) => {
    const { userId, clicks, energy, username } = req.body;
    const now = Math.floor(Date.now() / 1000);
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)]);
        if (userRes.rows.length === 0) return res.status(404).json({error: "Not found"});
        const user = userRes.rows[0];
        const timeDiff = now - parseInt(user.last_save || 0);
        const validClicks = Math.min(clicks || 0, Math.max(timeDiff, 1) * 15);
        const newBalance = parseFloat(user.balance) + (validClicks * parseInt(user.click_lvl));
        await pool.query('UPDATE users SET balance=$1, energy=$2, username=$3, last_save=$4, last_seen=$4 WHERE user_id=$5', [newBalance, Math.floor(energy), username, now, String(userId)]);
        res.json({ status: 'ok', balance: newBalance });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Улучшения
app.post('/api/upgrade', async (req, res) => {
    const { userId, type } = req.body;
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)]);
        const user = userRes.rows[0];
        let cost = type === 'click' ? getClickCost(parseInt(user.click_lvl)) : getPnlCost(parseFloat(user.pnl));
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

// 5. Админка приложения
app.post('/api/admin/:action', async (req, res) => {
    const secret = req.headers['admin-secret'];
    if (secret !== WEB_ADMIN_PASSWORD) return res.status(403).json({ error: "Wrong secret" });
    if (req.params.action === 'reset-db') {
        await pool.query('TRUNCATE TABLE users');
        res.json({ success: true });
    } else if (req.params.action === 'restart') {
        res.json({ success: true });
        setTimeout(() => process.exit(1), 500);
    }
});

// --- ТЕЛЕГРАМ БОТ ---
bot.start((ctx) => {
    const refId = ctx.payload || ''; 
    const gameUrl = `https://${DOMAIN}?u=${ctx.from.id}${refId ? '&ref=' + refId : ''}&v=${Date.now()}`;
    ctx.replyWithHTML(`<b>🧠 NEURAL PULSE AI</b>\n\nПривет, <b>${ctx.from.first_name}</b>!`, Markup.inlineKeyboard([[Markup.button.webApp('⚡ ЗАПУСТИТЬ ТЕРМИНАЛ', gameUrl)]]));
});

app.listen(PORT, () => {
    bot.launch();
    console.log(`🚀 Server on port ${PORT}`);
});
