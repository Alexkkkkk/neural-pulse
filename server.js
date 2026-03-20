const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

// --- КОНФИГУРАЦИЯ ---
const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
// Убедитесь, что эта строка подключения актуальна для Bothost
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const DOMAIN = "https://neural-pulse.bothost.ru"; 
const PORT = 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
const initDB = async () => {
    console.log("🛠 [DB] Connecting and checking tables...");
    try {
        // ДОБАВЛЕНО ПОЛЕ photo_url TEXT
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY, 
                username TEXT, 
                balance NUMERIC DEFAULT 0,  
                energy INTEGER DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                click_lvl INTEGER DEFAULT 1, 
                profit_hr NUMERIC DEFAULT 0,  
                lvl INTEGER DEFAULT 1,
                wallet TEXT,
                photo_url TEXT, 
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("✅ [DB] Database is ready (with Avatars support checked)");
    } catch (e) { console.error("❌ [DB ERROR] Initial failure:", e.message); }
};
initDB();

// --- API ЭНДПОИНТЫ ---

// ПОЛУЧЕНИЕ/СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ - ТЕПЕРЬ ПРИНИМАЕТ И ОБНОВЛЯЕТ photo_url
app.get('/api/user/:id', async (req, res) => {
    const userId = String(req.params.id);
    const username = req.query.username || 'Agent';
    const photoUrl = req.query.photo_url || null; // Получаем URL фото
    
    console.log(`📡 [GET] User Request: ${userId} (${username})`);
    
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            console.log(`🆕 [DB] Creating new player: ${userId}`);
            // Сохраняем и фото при создании
            await pool.query(
                'INSERT INTO users (user_id, username, photo_url) VALUES ($1, $2, $3)', 
                [userId, username, photoUrl]
            );
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        } else {
            // ОБНОВЛЯЕМ имя, фото и время входа при каждом визите
            console.log(`📝 [DB] Updating user data for: ${userId}`);
            await pool.query(
                'UPDATE users SET username = $2, photo_url = $3, last_seen = NOW() WHERE user_id = $1', 
                [userId, username, photoUrl]
            );
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const d = req.body;
    console.log(`💾 [SAVE] Updating progress for ${d.userId} (Balance: ${d.balance})`);
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, max_energy=$4, click_lvl=$5, profit_hr=$6, lvl=$7 WHERE user_id=$1`, 
            [String(d.userId), d.balance, d.energy, d.max_energy, d.click_lvl, d.profit_hr, d.lvl]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ТОП ИГРОКОВ - ТЕПЕРЬ ВОЗВРАЩАЕТ И photo_url
app.get('/api/top', async (req, res) => {
    console.log(`🏆 [TOP] Requested leaderboard...`);
    try {
        // Добавлен photo_url в выборку
        const result = await pool.query(
            'SELECT user_id, username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50'
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ... (остальной код бота и сервера без изменений, Webhook логика сохранена)
