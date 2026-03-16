const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');

const BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw";
const PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f";
const ADMIN_ID = 527506948; // Ваш Telegram ID для доступа к сбросу базы

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// ГЛУБОКАЯ СИНХРОНИЗАЦИЯ И АВТО-РЕМОНТ ТАБЛИЦ
const initDB = async () => {
    try {
        // Создаем базовую структуру, если её нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT DEFAULT 'Agent',
                avatar_url TEXT DEFAULT '',
                balance NUMERIC DEFAULT 0,
                energy INTEGER DEFAULT 1000,
                max_energy INTEGER DEFAULT 1000,
                click_lvl INTEGER DEFAULT 1,
                wallet_addr TEXT,
                has_bot BOOLEAN DEFAULT FALSE,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id TEXT, referred_id TEXT UNIQUE)`);

        // ПРОВЕРКА И ДОБАВЛЕНИЕ НОВЫХ КОЛОНОК (если обновляемся с v2.9.9)
        const columnsToEnsure = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_addr TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS has_bot BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ];
        for (let query of columnsToEnsure) { await pool.query(query).catch(() => {}); }
        
        console.log("System v3.3.5: Deep Sync Engine Ready");
    } catch (e) { console.error("CRITICAL DB ERROR:", e); }
};
initDB();

// --- API СИНХРОНИЗАЦИИ ---

app.get('/api/user/:id', async (req, res) => {
    const uid = req.params.id;
    const { name, photo } = req.query;
    try {
        let r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        
        // Валидация входных данных
        const vName = (!name || name === 'null' || name === 'undefined') ? (r.rows[0]?.username || 'Agent') : name;
        const vPhoto = (!photo || photo === 'null' || photo === 'undefined') ? (r.rows[0]?.avatar_url || '') : photo;

        if (!r.rows.length) {
            // Новый пользователь
            await pool.query('INSERT INTO users (user_id, username, avatar_url) VALUES ($1, $2, $3)', [uid, vName, vPhoto]);
            r = await pool.query('SELECT * FROM users WHERE user_id = $1', [uid]);
        } else {
            // Обновляем только метаданные при входе
            await pool.query('UPDATE users SET username=$1, avatar_url=$2, last_seen=NOW() WHERE user_id=$3', [vName, vPhoto, uid]);
        }
        res.json(r.rows[0]);
    } catch (e) { 
        console.error("Fetch Error:", e);
        res.status(500).json({ error: "Sync Failed" }); 
    }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, max_energy, click_lvl, wallet, has_bot } = req.body;
    try {
        // Проверка на NaN и null перед сохранением
        const safeBal = isNaN(parseFloat(balance)) ? 0 : parseFloat(balance);
        const safeEng = isNaN(parseInt(energy)) ? 1000 : parseInt(energy);
        
        await pool.query(`
            UPDATE users SET 
                balance=$2, energy=$3, max_energy=$4, click_lvl=$5, 
                wallet_addr=$6, has_bot=$7, last_seen=NOW() 
            WHERE user_id=$1
        `, [userId, safeBal, safeEng, max_energy, click_lvl, wallet, has_bot]);
        res.json({ ok: true });
    } catch (e) { 
        console.error("Save Error:", e);
        res.status(500).send("Sync Error"); 
    }
});

app.get('/api/top', async (req, res) => {
    try {
        const r = await pool.query('SELECT username, avatar_url, balance, user_id FROM users WHERE username != \'null\' ORDER BY balance DESC LIMIT 50');
        res.json(r.rows);
    } catch (e) { res.json([]); }
});

// --- АДМИН-ПАНЕЛЬ И БОТ ---

bot.start(async (ctx) => {
    const uid = ctx.from.id.toString();
    const buttons = [[Markup.button.webApp("OPEN CLUSTER v3.3.5", "https://neural-pulse.bothost.ru")]];
    
    if (ctx.from.id === ADMIN_ID) {
        buttons.push([Markup.button.callback("⚙️ DATABASE ADMIN", "admin_main")]);
    }

    ctx.replyWithHTML(`<b>Neural Pulse v3.3.5</b>\nSystem is fully synchronized with PostgreSQL.`, Markup.inlineKeyboard(buttons));
});

bot.action("admin_main", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText("<b>DATABASE CONTROL</b>\n\nОпасно: полное удаление данных игроков.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🧨 СБРОСИТЬ ВСЮ БАЗУ", "confirm_wipe")],
            [Markup.button.callback("⬅️ ВЕРНУТЬСЯ", "exit_admin")]
        ])
    });
});

bot.action("confirm_wipe", (ctx) => {
    ctx.editMessageText("<b>ВЫ УВЕРЕНЫ?</b>\nЭто удалит ВСЕХ пользователей, балансы и рефералов.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ ДА, УДАЛИТЬ", "execute_wipe")],
            [Markup.button.callback("❌ ОТМЕНА", "admin_main")]
        ])
    });
});

bot.action("execute_wipe", async (ctx) => {
    try {
        await pool.query('TRUNCATE users, referrals RESTART IDENTITY CASCADE');
        ctx.answerCbQuery("DATABASE WIPED");
        ctx.editMessageText("✅ <b>База данных полностью очищена.</b>", { parse_mode: 'HTML' });
    } catch (e) { ctx.reply("Error: " + e.message); }
});

bot.action("exit_admin", (ctx) => {
    ctx.editMessageText("<b>Neural Pulse v3.3.5</b>", Markup.inlineKeyboard([[Markup.button.webApp("OPEN CLUSTER", "https://neural-pulse.bothost.ru")]]));
});

app.listen(3000, () => { console.log("v3.3.5 Synchronizer Online"); bot.launch(); });
