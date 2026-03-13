const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "neural-pulse.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());

// Статика из public
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
    if (r.rows.length === 0) {
        r = await pool.query('INSERT INTO users (user_id, username, balance, energy) VALUES ($1, $2, 0, 1000) RETURNING *', [uid, 'Agent']);
    }
    res.json(r.rows[0]);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy } = req.body;
    await pool.query('UPDATE users SET balance = $2, energy = $3 WHERE user_id = $1', [String(userId), balance, energy]);
    res.json({ ok: true });
});

bot.start(ctx => ctx.replyWithHTML(
    `<b>NEURAL PULSE v1.0.4</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ INITIALIZE', `https://${DOMAIN}`)]])
));

app.listen(PORT, () => { 
    console.log(`Server online. Path: ${publicPath}`);
    bot.launch(); 
});
