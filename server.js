import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';

// --- ПАКЕТЫ АДМИНКИ ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSql from '@adminjs/sql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Регистрация адаптера
AdminJS.registerAdapter({
    Database: AdminJSSql.Database,
    Resource: AdminJSSql.Resource,
});

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_db5b342fc026:gwp3jv20PY7JtERt4cNIvSpReq8YpLYzlH99BY5vyc4@node1.pghost.ru:32867/bothost_db_db5b342fc026";
const DOMAIN = "https://neural-pulse.duckdns.org"; 
const PORT = 3000;

const ADMIN_USER = {
    email: 'admin@pulse.com',
    password: 'Kander3132001574', 
};

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false,
    max: 20, 
    idleTimeoutMillis: 30000 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
const initDB = async () => {
    console.log("🛠 [DB] Проверка структуры...");
    try {
        const client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY, 
                username TEXT, 
                photo_url TEXT,
                balance DOUBLE PRECISION DEFAULT 0,  
                energy DOUBLE PRECISION DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                tap INTEGER DEFAULT 1, 
                profit INTEGER DEFAULT 0,
                referrer_id BIGINT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance DESC)`);
        console.log("✅ [DB] Таблица users готова");
        client.release();
    } catch (e) { 
        console.error("❌ [DB ERROR]:", e.message); 
    }
};

// --- ФУНКЦИЯ ЗАПУСКА АДМИНКИ ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            // Убираем databases: [pool], чтобы избежать ошибки forEach
            rootPath: '/admin',
            branding: {
                companyName: 'Neural Pulse Admin',
                softwareBrothers: false,
                theme: { colors: { primary100: '#00ff41' } }
            },
            resources: [
                {
                    // Явно указываем ресурс через параметры подключения
                    resource: {
                        adapter: AdminJSSql,
                        model: { tableName: 'users', connectionOptions: { connectionString: PG_URI, dialect: 'postgres' } }
                    },
                    options: {
                        navigation: { name: 'Игроки', icon: 'User' },
                        properties: {
                            id: { isId: true },
                            photo_url: { isVisible: { list: false, edit: true, filter: false, show: true } },
                            last_seen: { isVisible: { list: true, edit: false, filter: true, show: true } }
                        }
                    }
                }
            ]
        });

        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
                    return ADMIN_USER;
                }
                return null;
            },
            cookieName: 'adminjs-session',
            cookiePassword: 'super-secret-password-123',
        }, null, {
            resave: false,
            saveUninitialized: true,
            secret: 'super-secret-session-secret',
        });

        app.use(adminJs.options.rootPath, router);
        console.log(`🔐 [ADMIN] Панель управления активирована`);
    } catch (error) {
        console.error("❌ [ADMIN ERROR]:", error.message);
    }
};

await initDB();
await startAdmin();

// --- API ЭНДПОИНТЫ ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url, ref } = req.query;
    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            const referrer = (ref && ref !== userId) ? ref : null;
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url, referrer_id) VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '', referrer]
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
        const result = await pool.query('SELECT username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: "Top error" }); }
});

// --- ТЕЛЕГРАМ БОТ ---
bot.start((ctx) => {
    const refId = ctx.startPayload;
    const webAppUrl = refId ? `${DOMAIN}?ref=${refId}` : DOMAIN;
    ctx.reply(`<b>Neural Pulse | Sync Active</b>\nWelcome, Agent <b>${ctx.from.first_name}</b>.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", webAppUrl)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    console.log(`\n🚀 ==========================================`);
    console.log(`🚀 СЕРВЕР: ${DOMAIN}`);
    console.log(`🚀 ПОРТ: ${PORT}`);
    console.log(`🚀 ==========================================\n`);
    await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
});
