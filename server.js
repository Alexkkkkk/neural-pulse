const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

// Пакеты для визуальной админки
const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const AdminJSSql = require('@adminjs/sql');

AdminJS.registerAdapter(AdminJSSql);

// --- КОНФИГУРАЦИЯ ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_db5b342fc026:gwp3jv20PY7JtERt4cNIvSpReq8YpLYzlH99BY5vyc4@node1.pghost.ru:32867/bothost_db_db5b342fc026";
const DOMAIN = "https://neural-pulse.duckdns.org"; 
const PORT = 3000;

// ТВОИ ДАННЫЕ ДЛЯ ВХОДА В АДМИНКУ
const ADMIN_USER = {
  email: 'admin@pulse.com',
  password: 'Kander3132001574', 
};

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const pool = new Pool({ connectionString: PG_URI, ssl: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- НАСТРОЙКА ЗАЩИЩЕННОЙ АДМИНКИ ---
const startAdmin = async () => {
    const adminJs = new AdminJS({
      databases: [{
        connectionString: PG_URI,
        dialect: 'postgres',
      }],
      rootPath: '/admin',
      branding: {
        companyName: 'Neural Pulse Admin',
        softwareBrothers: false,
        theme: {
          colors: { primary100: '#00ff41' } // Зеленый "хакерский" стиль
        }
      },
    });

    const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
      authenticate: async (email, password) => {
        if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
          return ADMIN_USER;
        }
        return null;
      },
      cookieName: 'adminjs-session',
      cookiePassword: 'super-secret-cookie-password-2026',
    }, null, {
      resave: false,
      saveUninitialized: true,
      secret: 'super-secret-session-secret',
    });

    app.use(adminJs.options.rootPath, router);
    console.log(`\n🔐 [ADMIN] Панель управления защищена паролем.`);
    console.log(`🔐 [ADMIN] URL: ${DOMAIN}/admin`);
    console.log(`🔐 [ADMIN] LOGIN: ${ADMIN_USER.email}\n`);
};

// --- ИНИЦИАЛИЗАЦИЯ БД ---
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY, 
                username TEXT, 
                photo_url TEXT,
                balance DOUBLE PRECISION DEFAULT 0,  
                energy DOUBLE PRECISION DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                tap INTEGER DEFAULT 1, 
                profit INTEGER DEFAULT 0,  
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("✅ [DB] Таблица пользователей активна");
    } catch (e) { console.error("❌ [DB ERROR]:", e.message); }
};

initDB();
startAdmin();

// --- API ЭНДПОИНТЫ ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url } = req.query;
    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url) VALUES ($1, $2, $3) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '']
            );
            return res.json(newUser.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/save', async (req, res) => {
    const d = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [d.userId, d.balance, d.energy, d.tap, d.profit]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save error" }); }
});

app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: "Top error" }); }
});

// --- ТЕЛЕГРАМ БОТ ---
bot.start((ctx) => {
    ctx.reply(`<b>Neural Pulse | System Active</b>\nWelcome, Agent <b>${ctx.from.first_name}</b>.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", DOMAIN)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    console.log(`🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT}`);
    await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
});
