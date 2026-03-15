const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const VERSION = "2.1.5";
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, 
            username TEXT DEFAULT 'Neural Player',
            balance NUMERIC DEFAULT 0,
            energy INTEGER DEFAULT 1000,
            max_energy INTEGER DEFAULT 1000,
            click_lvl INTEGER DEFAULT 1,
            pnl NUMERIC DEFAULT 0,
            wallet_address TEXT DEFAULT NULL,
            friends_count INTEGER DEFAULT 0,
            last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    } catch (e) { console.error("DB Error:", e); }
};
initDB();

app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    const name = req.query.name || 'Neural Player';
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        if (r.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id, username) VALUES ($1, $2)', [uid, name]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, username, balance, energy, max_energy, click_lvl, pnl, wallet } = req.body;
    try {
        await pool.query(
            `UPDATE users SET username=$2, balance=$3, energy=$4, max_energy=$5, click_lvl=$6, pnl=$7, wallet_address=$8, last_sync=NOW() WHERE user_id=$1`, 
            [String(userId), username, Number(balance), Number(energy), Number(max_energy), Number(click_lvl), Number(pnl), wallet]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).send(e.message); }
});

// --- ОБНОВЛЕННЫЙ ТОП API v2.1.5 ---
// Теперь возвращает user_id, чтобы фронтенд мог запросить фото
app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT user_id, username, balance FROM users ORDER BY balance DESC LIMIT 10');
        res.json(r.rows);
    } catch (e) { res.status(500).json([]); }
});

/* --- НОВЫЙ МАРШРУТ GET PHOTO v2.1.5 --- */
// Этот API запрашивает у Telegram URL аватарки пользователя по его ID
app.get('/api/photo/:id', async (req, res) => {
    const uid = Number(req.params.id);
    if (!uid || isNaN(uid) || uid <= 0) return res.status(404).send('No photo');

    try {
        // 1. Запрашиваем у TG список фото пользователя
        const photos = await bot.telegram.getUserProfilePhotos(uid);
        if (!photos || photos.total_count === 0) return res.status(404).send('No photo');

        // Берем самое первое фото, самый маленький размер
        const fileId = photos.photos[0][0].file_id;
        
        // 2. Получаем прямую ссылку на файл
        const fileUrl = await bot.telegram.getFileLink(fileId);
        
        // 3. Перенаправляем браузер на эту ссылку
        res.redirect(fileUrl.href);
    } catch (e) {
        // Если ошибка (например, старый ID или нет фото)
        console.log(`Photo error for ${uid}`);
        res.status(404).send('Error');
    }
});
/* ------------------------------------- */

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'static', 'index.html')));

bot.start((ctx) => {
    ctx.replyWithHTML(`<b>🚀 NEURAL PULSE v${VERSION}</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp('⚡ START', `https://neural-pulse.bothost.ru`)]]));
});

app.listen(3000, () => { 
    console.log(`Server v${VERSION} Online`); 
    bot.launch().catch(err => console.error(err));
});
