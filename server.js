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

// Парсинг числовых значений
const types = require('pg').types;
types.setTypeParser(1700, function(val) { return parseFloat(val); });

pool.on('error', (err) => {
    console.error('❌ [DB Pool Error]:', err.message);
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// --- ИНИЦИАЛИЗАЦИЯ И ФИКС ТАБЛИЦЫ ---
const initDB = async () => {
    try {
        // 1. Создаем таблицу, если её нет
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

        // 2. ПРИНУДИТЕЛЬНО добавляем колонку last_save, если она исчезла (фикс твоей ошибки)
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_save') THEN
                    ALTER TABLE users ADD COLUMN last_save BIGINT DEFAULT extract(epoch from now());
                END IF;
            END $$;
        `);

        console.log("✅ [DB] Таблицы проверены и готовы.");
    } catch (err) { 
        console.error("❌ [DB] Ошибка инициализации:", err.message); 
    }
};
initDB();

// --- API ---

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const refBy = req.query.ref;
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, referrer_id, last_seen, last_save) VALUES ($1, $2, extract(epoch from now()), extract(epoch from now()))', [uid, refBy]);
            if (refBy && refBy !== uid) {
                await pool.query('UPDATE users SET balance = balance + 5000 WHERE user_id IN ($1, $2)', [uid, refBy]);
            }
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        let user = result.rows[0];
        const now = Math.floor(Date.now() / 1000);
        const diff = now - parseInt(user.last_seen);

        if (diff > 60 && parseFloat(user.pnl) > 0) {
            const hours = Math.min(diff, 14400) / 3600;
            const passiveIncome = parseFloat(user.pnl) * hours;
            user.balance = parseFloat(user.balance) + passiveIncome;
            user.energy = Math.min(1000, parseFloat(user.energy) + (diff * 1.5));
            user.last_seen = now;
            await pool.query('UPDATE users SET balance=$1, energy=$2, last_seen=$3 WHERE user_id=$4', 
                [user.balance, Math.floor(user.energy), user.last_seen, uid]);
        }
        res.json(user);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 10');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: "Top Error" }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, clicks, energy, username } = req.body;
    const now = Math.floor(Date.now() / 1000);
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)]);
        if (userRes.rows.length === 0) return res.status(404).json({error: "Not found"});
        
        const user = userRes.rows[0];
        // Используем last_save для анти-чита
        const lastSaveTime = parseInt(user.last_save || now);
        const timeDiff = Math.max(now - lastSaveTime, 1);
        
        const maxClicksAllowed = timeDiff * 15;
        const finalClicks = Math.min(clicks || 0, maxClicksAllowed);
        
        const income = finalClicks * parseInt(user.click_lvl);
        const newBalance = parseFloat(user.balance) + income;

        await pool.query('UPDATE users SET balance=$1, energy=$2, username=$3, last_save=$4, last_seen=$4 WHERE user_id=$5', 
            [newBalance, Math.floor(energy), username || 'Player', now, String(userId)]);
            
        res.json({ status: 'ok', balance: newBalance });
    } catch (e) { 
        console.error("Save error:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/upgrade', async (req, res) => {
    const { userId, type } = req.body;
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)]);
        const user = userRes.rows[0];
        if (!user) return res.json({ success: false });

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

// --- BOT ---
bot.start((ctx) => {
    const refId = ctx.payload || ''; 
    const gameUrl = `https://${DOMAIN}?u=${ctx.from.id}${refId ? '&ref=' + refId : ''}&v=${Date.now()}`;
    ctx.replyWithHTML(`<b>🧠 NEURAL PULSE AI</b>\n\nПривет, <b>${ctx.from.first_name}</b>!\nНачинай майнинг NP прямо сейчас.`, 
        Markup.inlineKeyboard([[Markup.button.webApp('⚡ ЗАПУСТИТЬ ТЕРМИНАЛ', gameUrl)]]));
});

bot.catch((err) => { console.error('Telegraf error:', err); });

app.listen(PORT, () => {
    bot.launch().catch(err => console.error("Bot launch failed:", err));
    console.log(`🚀 Server running on port ${PORT}`);
});
