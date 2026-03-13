const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const APP_VERSION = "1.1.1-PUBLIC-FOLDER";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());

// ПРАВИЛО: Файлы всегда в папке public (согласно структуре GitHub)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Явный роутинг для главной страницы из public
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// API
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    if (r.rows.length === 0) {
        r = await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2) RETURNING *', [uid, 'Agent']);
    }
    res.json(r.rows[0]);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, pnl } = req.body;
    await pool.query(`
        UPDATE users SET balance = $2, energy = $3, pnl = $4, last_seen = extract(epoch from now())
        WHERE user_id = $1
    `, [String(userId), Number(balance), Math.floor(energy), Number(pnl)]);
    res.json({ status: 'ok' });
});

bot.start(ctx => ctx.replyWithHTML(
    `<b>SYSTEM READY</b>\n\nBuild: <code>${APP_VERSION}</code>`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://${DOMAIN}`)]])
));

app.listen(PORT, () => { 
    console.log(`[BOOT] Neural Pulse: PUBLIC FOLDER MODE`);
    console.log(`[BOOT] Version: ${APP_VERSION}`);
    console.log(`[BOOT] Path: ${publicPath}`);
    bot.launch(); 
});
