const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                balance NUMERIC DEFAULT 0, 
                energy INTEGER DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000, 
                click_lvl INTEGER DEFAULT 1, 
                pph NUMERIC DEFAULT 0,
                mine_lvls JSONB DEFAULT '{"cpu":0, "gpu":0, "asic":0}',
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("Database Sync: v3.8.0 MINE Ready");
    } catch (e) { console.error(e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const { name } = req.query;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        if (!r.rows.length) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [req.params.id, name || 'Agent']);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
        }
        
        const user = r.rows[0];
        const now = new Date();
        const lastSeen = new Date(user.last_seen);
        const secondsOffline = Math.floor((now - lastSeen) / 1000);
        
        // Считаем прибыль за время отсутствия (макс за 3 часа, чтобы не ломать экономику)
        let offlineProfit = 0;
        if (user.pph > 0 && secondsOffline > 60) {
            const cappedSeconds = Math.min(secondsOffline, 10800); 
            offlineProfit = (user.pph / 3600) * cappedSeconds;
            await pool.query('UPDATE users SET balance = balance + $1, last_seen = CURRENT_TIMESTAMP WHERE user_id = $2', [offlineProfit, user.user_id]);
        }

        res.json({ ...user, offline_profit: offlineProfit });
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, pph, mine_lvls } = req.body;
    try {
        await pool.query(`
            UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, pph=$6, mine_lvls=$7, last_seen=CURRENT_TIMESTAMP 
            WHERE user_id=$1`, [userId, balance, energy, max_energy, click_lvl, pph, JSON.stringify(mine_lvls)]);
        res.json({ok: true});
    } catch (e) { res.status(500).send(e.message); }
});

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>Neural Pulse v3.8.0</b>\nNeural Farms: Online`, 
    Markup.inlineKeyboard([[Markup.button.webApp("ЗАПУСТИТЬ МАЙНИНГ", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { console.log("v3.8.0 Live"); bot.launch(); });
