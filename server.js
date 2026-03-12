const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
                wallet_address TEXT,
                referrer_id TEXT,
                last_seen BIGINT DEFAULT extract(epoch from now())
            );
        `);
        console.log("📦 [DB] База готова.");
    } catch (err) { console.error("❌ [DB] Ошибка:", err.message); }
};
initDB();

// API получения данных пользователя
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const refBy = req.query.ref; // Получаем ID пригласителя

    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        
        if (result.rows.length === 0) {
            // Регистрация нового пользователя
            await pool.query(
                'INSERT INTO users (user_id, referrer_id, last_seen) VALUES ($1, $2, extract(epoch from now()))', 
                [uid, refBy]
            );
            // Если есть реферал, даем обоим по 5000 бонуса
            if (refBy && refBy !== uid) {
                await pool.query('UPDATE users SET balance = balance + 5000 WHERE user_id IN ($1, $2)', [uid, refBy]);
            }
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }

        let user = result.rows[0];
        const now = Math.floor(Date.now() / 1000);
        const diff = now - parseInt(user.last_seen);

        if (diff > 0) {
            // Расчет регенерации и пассивного дохода
            const energyRegen = diff * 1.5;
            const passiveIncome = (parseFloat(user.pnl) / 3600) * diff;
            
            user.energy = Math.min(1000, parseFloat(user.energy) + energyRegen);
            user.balance = parseFloat(user.balance) + passiveIncome;
            user.last_seen = now;

            // СРАЗУ сохраняем начисленное в базу, чтобы не потерять
            await pool.query(
                'UPDATE users SET balance=$1, energy=$2, last_seen=$3 WHERE user_id=$4',
                [user.balance, Math.floor(user.energy), user.last_seen, uid]
            );
        }

        res.json(user);
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "DB Error" }); 
    }
});

// Безопасное сохранение (обработка кликов)
app.post('/api/save', async (req, res) => {
    const { userId, clicks, energy, wallet_address } = req.body;
    try {
        // Берем актуальный уровень клика из базы для защиты
        const userRes = await pool.query('SELECT click_lvl, balance FROM users WHERE user_id = $1', [String(userId)]);
        const user = userRes.rows[0];
        
        const income = (Number(clicks) || 0) * parseInt(user.click_lvl);
        const newBalance = parseFloat(user.balance) + income;

        await pool.query(`
            UPDATE users SET 
                balance=$1, energy=$2, wallet_address=COALESCE($3, wallet_address), last_seen=extract(epoch from now())
            WHERE user_id=$4
        `, [newBalance, Math.floor(energy), wallet_address, String(userId)]);
        
        res.json({ status: 'ok', balance: newBalance });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// API покупки улучшений (Click Lvl и PNL)
app.post('/api/upgrade', async (req, res) => {
    const { userId, type } = req.body;
    try {
        const user = (await pool.query('SELECT * FROM users WHERE user_id = $1', [String(userId)])).rows[0];
        let cost = type === 'click' ? (parseInt(user.click_lvl) * 750) : (parseFloat(user.pnl) + 100) * 15;
        
        if (parseFloat(user.balance) >= cost) {
            const query = type === 'click' 
                ? 'UPDATE users SET balance=balance-$1, click_lvl=click_lvl+1 WHERE user_id=$2'
                : 'UPDATE users SET balance=balance-$1, pnl=pnl+200 WHERE user_id=$2';
            
            await pool.query(query, [cost, userId]);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: "Insufficient funds" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/tonconnect-manifest.json', (req, res) => {
    res.json({
        "url": `https://${DOMAIN}`,
        "name": "Neural Pulse AI",
        "iconUrl": `https://${DOMAIN}/logo.png`
    });
});

bot.start((ctx) => {
    const refId = ctx.payload || ''; // ID пригласителя из ссылки t.me/bot?start=123
    const gameUrl = `https://${DOMAIN}?u=${ctx.from.id}${refId ? '&ref=' + refId : ''}`;
    
    ctx.replyWithHTML(
        `<b>🚀 ДОБРО ПОЖАЛОВАТЬ В NEURAL PULSE AI</b>\n\n` +
        `Майни токены NP и подключай свой кошелек TON.`,
        Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', gameUrl)]])
    );
});

app.listen(PORT, () => {
    bot.launch();
    console.log(`🚀 Server running on port ${PORT}`);
});
