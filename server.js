import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session'; // Добавлено

// --- ИМПОРТЫ АДМИНКИ ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSql from '@adminjs/sql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. РЕГИСТРАЦИЯ АДАПТЕРА
AdminJS.registerAdapter({
    Database: AdminJSSql.Database,
    Resource: AdminJSSql.Resource,
});

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_db5b342fc026:gwp3jv20PY7JtERt4cNIvSpReq8YpLYzlH99BY5vyc4@node1.pghost.ru:32867/bothost_db_db5b342fc026";
const DOMAIN = "https://neural-pulse.bothost.ru"; 
const PORT = 3000;

const ADMIN_USER = {
    email: 'admin@pulse.com',
    password: 'Kander3132001574', 
};

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json());
// Настройка сессий для админки
app.use(session({
    secret: 'admin_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, secure: false } // false т.к. работаем за прокси Bothost
}));
app.use(express.static(path.join(__dirname, 'static')));

const pool = new Pool({ connectionString: PG_URI, ssl: false });

// --- ИНИЦИАЛИЗАЦИЯ БД ---
const initDB = async () => {
    const client = await pool.connect();
    try {
        console.log("🛠 [DB] Проверка таблиц...");
        await client.query(`CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, username TEXT, balance DOUBLE PRECISION DEFAULT 0, energy DOUBLE PRECISION DEFAULT 1000, max_energy INTEGER DEFAULT 1000, tap INTEGER DEFAULT 1, profit INTEGER DEFAULT 0, last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await client.query(`CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, title TEXT NOT NULL, reward INTEGER DEFAULT 1000, url TEXT)`);
        console.log("✅ [DB] Таблицы проверены");
    } finally { client.release(); }
};

// --- ЗАПУСК АДМИНКИ ---
const startAdmin = async () => {
    try {
        console.log("⚙️ [ADMIN] Инициализация ресурсов...");

        const adminJs = new AdminJS({
            resources: [
                {
                    resource: {
                        model: AdminJSSql.Resource,
                        database: AdminJSSql.Database,
                        tableName: 'users',
                        connectionOptions: { connectionString: PG_URI, dialect: 'postgres' }
                    },
                    options: { navigation: { name: 'Игроки', icon: 'User' } }
                }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse Admin', softwareBrothers: false }
        });

        // Используем встроенный метод сборки роутера
        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === ADMIN_USER.email && password === ADMIN_USER.password) return ADMIN_USER;
                return null;
            },
            cookieName: 'adminjs',
            cookiePassword: 'super-long-secure-password-12345678',
        }, null, {
            resave: false, 
            saveUninitialized: true, 
            secret: 'admin_secret_key'
        });

        app.use(adminJs.options.rootPath, router);
        console.log(`✅ [ADMIN] Админка готова: ${DOMAIN}/admin`);
    } catch (e) { 
        console.error("❌ [ADMIN ERROR]:", e.message); 
    }
};

// --- API ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            const { username } = req.query;
            const newUser = await pool.query(`INSERT INTO users (id, username) VALUES ($1, $2) RETURNING *`, [userId, username || 'Agent']);
            return res.json(newUser.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy } = req.body;
    try {
        await pool.query(`UPDATE users SET balance=$2, energy=$3, last_seen=NOW() WHERE id=$1`, [userId, balance, energy]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save error" }); }
});

// --- BOT ---
bot.start((ctx) => {
    ctx.reply(`Neural Pulse Active.`, Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]]));
});

app.use(bot.webhookCallback(`/telegraf/${BOT_TOKEN}`));

app.listen(PORT, async () => {
    await initDB();
    await startAdmin();
    console.log(`🚀 [SERVER] На ${DOMAIN}`);
    await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);
});
