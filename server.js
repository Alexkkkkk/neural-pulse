const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

// --- КОНФИГ АДМИНА ---
const ADMIN_ID = 123456789; // ЗАМЕНИТЕ на ваш Telegram ID
const ADMIN_SECRET = "super_pulse_secret_99"; // Секретный ключ для API

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const pool = new Pool({ 
    connectionString: PG_URI,
    ssl: false 
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для защиты админ-роутов
const adminAuth = (req, res, next) => {
    const key = req.headers['admin-secret'];
    if (key === ADMIN_SECRET) {
        next();
    } else {
        res.status(403).json({ error: "Access Denied" });
    }
};

// --- МАТЕМАТИКА ---
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
                wallet_address TEXT,
                referrer_id TEXT,
                last_seen BIGINT DEFAULT extract(epoch from now()),
                last_save BIGINT DEFAULT extract(epoch from now())
            );
        `);
        console.log("✅ [DB] Система готова.");
    } catch (err) { console.error("❌ [DB] Ошибка:", err.message); }
};
initDB();

// --- АДМИН ЭНДПОИНТЫ ---

// 1. Сброс базы
app.post('/api/admin/reset-db', adminAuth, async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE users');
        res.json({ success: true, message: "База данных полностью очищена" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Сброс кеша (в данной архитектуре это сброс параметров входа)
app.post('/api/admin/reset-cache', adminAuth, async (req, res) => {
    try {
        await pool.query('UPDATE users SET last_seen = extract(epoch from now())');
        res.json({ success: true, message: "Кеш сессий сброшен" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Рестарт сервера
app.post('/api/admin/restart', adminAuth, (req, res) => {
    res.json({ success: true, message: "Сервер уходит на перезагрузку..." });
    setTimeout(() => { process.exit(1); }, 1000);
});

// --- ИГРОВЫЕ РОУТЫ ---

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

app.post('/api/save', async (req, res) => {
    const { userId, clicks, energy, username } = req.body;
    const now = Math.floor(Date.now() / 1000);
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)]);
        if (userRes.rows.length === 0) return res.status(404).json({error: "Not found"});
        const user = userRes.rows[0];
        const timeDiff = now - parseInt(user.last_save || 0);
        const maxClicks = Math.max(timeDiff, 1) * 15;
        const validClicks = Math.min(clicks || 0, maxClicks);
        const income = validClicks * parseInt(user.click_lvl);
        const newBalance = parseFloat(user.balance) + income;
        await pool.query(`UPDATE users SET balance=$1, energy=$2, username=COALESCE($3, username, 'User_' || substr(user_id, 1, 4)), last_save=$4, last_seen=$4 WHERE user_id=$5`, [newBalance, Math.floor(energy), username, now, String(userId)]);
        res.json({ status: 'ok', balance: newBalance });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upgrade', async (req, res) => {
    const { userId, type } = req.body;
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)]);
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({error: "User not found"});
        let cost, updateQuery;
        if (type === 'click') {
            cost = getClickCost(user.click_lvl);
            updateQuery = 'UPDATE users SET balance=balance-$1, click_lvl=click_lvl+1 WHERE user_id=$2';
        } else if (type === 'pnl') {
            cost = getPnlCost(user.pnl);
            updateQuery = `UPDATE users SET balance=balance-$1, pnl=pnl+${MATH.PNL_STEP} WHERE user_id=$2`;
        }
        if (parseFloat(user.balance) >= cost) {
            await pool.query(updateQuery, [cost, userId]);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: "Low balance" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query(`SELECT COALESCE(username, 'Miner_' || substr(user_id, 1, 5)) as username, balance FROM users ORDER BY balance DESC LIMIT 10`);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: "Top error" }); }
});

// --- КОМАНДЫ БОТА ---

// Команда /admin для владельца
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply("❌ У вас нет прав доступа.");
    
    ctx.replyWithHTML("<b>🛠 ПАНЕЛЬ УПРАВЛЕНИЯ</b>\nВыберите действие:", 
        Markup.inlineKeyboard([
            [Markup.button.callback("🔥 Сброс базы", "admin_reset_db")],
            [Markup.button.callback("🧹 Сброс кеша", "admin_reset_cache")],
            [Markup.button.callback("♻️ Рестарт сервера", "admin_restart")]
        ])
    );
});

// Обработка кнопок админки
bot.action('admin_reset_db', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        await pool.query('TRUNCATE TABLE users');
        ctx.answerCbQuery("База очищена!");
        ctx.reply("✅ Таблица пользователей успешно очищена.");
    } catch (e) { ctx.reply("Ошибка: " + e.message); }
});

bot.action('admin_restart', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.answerCbQuery("Перезагрузка...");
    ctx.reply("♻️ Сервер будет перезагружен через 1 секунду.");
    setTimeout(() => { process.exit(1); }, 1000);
});

bot.start((ctx) => {
    const refId = ctx.payload || ''; 
    const gameUrl = `https://${DOMAIN}?u=${ctx.from.id}${refId ? '&ref=' + refId : ''}&v=${Date.now()}`;
    ctx.replyWithHTML(
        `<b>🧠 NEURAL PULSE AI</b>\n\n` +
        `Добро пожаловать, ${ctx.from.first_name}!\n` +
        `Твоя нейросеть готова к майнингу.`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('⚡ ИГРАТЬ', gameUrl)],
            [Markup.button.url('📢 КАНАЛ ПРОЕКТА', 'https://t.me/your_channel')]
        ])
    );
});

app.listen(PORT, () => {
    bot.launch();
    console.log(`🚀 Server on port ${PORT}`);
});
