// Version: 1.3.8
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "1.3.8";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация базы данных с проверкой всех необходимых колонок
const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, balance NUMERIC DEFAULT 0)`);
        
        const columns = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS energy INTEGER DEFAULT 1000",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS click_lvl INTEGER DEFAULT 1",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS pnl NUMERIC DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS rank TEXT DEFAULT 'Bronze Node'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS offline_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_count INTEGER DEFAULT 0"
        ];

        for (let cmd of columns) {
            try { await pool.query(cmd); } catch (e) { /* Колонка уже существует */ }
        }

        console.log(`v${VERSION} Database Synced & Online`);
    } catch (err) { console.error("DB Error:", err); }
};
initDB();

// Маршрут получения данных пользователя (с учетом рефералов)
app.get('/api/user/:id', async (req, res) => {
    try {
        const uid = String(req.params.id);
        const ref = req.query.ref; // ID пригласившего
        
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        
        if (result.rows.length === 0) {
            // Новый пользователь
            await pool.query('INSERT INTO users (user_id, referred_by) VALUES ($1, $2)', [uid, (ref && ref !== uid) ? ref : null]);
            
            // Награда пригласившему
            if (ref && ref !== uid) {
                await pool.query('UPDATE users SET balance = balance + 5000, ref_count = ref_count + 1 WHERE user_id = $1', [ref]);
            }
            
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        
        let user = result.rows[0];
        const now = new Date();
        const diff = (now - new Date(user.offline_sync || now)) / 1000 / 3600;
        
        // Оффлайн доход (максимум за 3 часа)
        if (diff > 0.1 && user.pnl > 0) {
            const reward = Number(user.pnl) * Math.min(diff, 3);
            user.balance = Number(user.balance) + reward;
            await pool.query('UPDATE users SET balance = $1, offline_sync = CURRENT_TIMESTAMP WHERE user_id = $2', [user.balance, uid]);
        }
        
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Сохранение прогресса
app.post('/api/save', async (req, res) => {
    try {
        const { userId, balance, energy, click_lvl, pnl, rank } = req.body;
        await pool.query(`
            UPDATE users SET balance = $2, energy = $3, click_lvl = $4, pnl = $5, rank = $6, 
            last_active = CURRENT_TIMESTAMP, offline_sync = CURRENT_TIMESTAMP
            WHERE user_id = $1
        `, [String(userId), Number(balance), Math.floor(energy), Math.floor(click_lvl), Number(pnl), rank]);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Мониторинг сети (для вкладки Stats)
app.get('/api/admin/monitor', async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, balance, pnl, rank FROM users ORDER BY balance DESC LIMIT 15');
        res.json(result.rows);
    } catch (e) { res.status(500).send(e.message); }
});

// Бот: обработка /start с реферальной ссылкой
bot.start(async (ctx) => {
    const refId = ctx.startPayload; // Параметр из ссылки t.me/bot?start=123
    const url = `https://${DOMAIN}?ref=${refId || ''}`;
    
    ctx.replyWithHTML(
        `<b>🚀 NEURAL PULSE v${VERSION}</b>\n\nДобро пожаловать в систему управления узлами.`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('⚡ ЗАПУСТИТЬ', url)]
        ])
    );
});

app.listen(PORT, () => { 
    console.log(`Server v${VERSION} Online`); 
    bot.launch().catch(err => console.error("Bot Launch Error:", err)); 
});
