import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

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
const DOMAIN = "https://neural-pulse.duckdns.org"; 
const PORT = 3000;

const ADMIN_USER = {
    email: 'admin@pulse.com',
    password: 'Kander3132001574', 
};

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const pool = new Pool({ connectionString: PG_URI, ssl: false });

// --- ИНИЦИАЛИЗАЦИЯ БД С ПРИНУДИТЕЛЬНЫМ СБРОСОМ ---
const initDB = async () => {
    const client = await pool.connect();
    try {
        console.log("🛠 [DB] Принудительная очистка и создание структур...");
        
        // Удаляем старые таблицы, чтобы разорвать неправильные связи
        await client.query(`DROP TABLE IF EXISTS user_tasks, tasks, users CASCADE`);

        // Создаем заново в строгом порядке
        await client.query(`
            CREATE TABLE users (
                id BIGINT PRIMARY KEY, 
                username TEXT, 
                photo_url TEXT,
                balance DOUBLE PRECISION DEFAULT 0,  
                energy DOUBLE PRECISION DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                tap INTEGER DEFAULT 1, 
                profit INTEGER DEFAULT 0,
                referrer_id BIGINT,
                last_daily_claim TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        
        await client.query(`
            CREATE TABLE tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                reward INTEGER DEFAULT 1000,
                url TEXT,
                category TEXT DEFAULT 'social'
            )`);

        await client.query(`
            CREATE TABLE user_tasks (
                user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, task_id)
            )`);

        console.log("✅ [DB] База данных успешно пересоздана");
    } catch (e) {
        console.error("❌ [DB ERROR]:", e.message);
    } finally {
        client.release();
    }
};

// --- ЗАПУСК АДМИНКИ ---
const startAdmin = async () => {
    try {
        // Мы передаем адаптер прямо в ресурс для надежности
        const adminJs = new AdminJS({
            resources: [
                { 
                    resource: { model: { tableName: 'users', connectionOptions: { connectionString: PG_URI, dialect: 'postgres' } }, adapter: AdminJSSql },
                    options: { navigation: { name: 'Управление', icon: 'User' } }
                },
                { 
                    resource: { model: { tableName: 'tasks', connectionOptions: { connectionString: PG_URI, dialect: 'postgres' } }, adapter: AdminJSSql },
                    options: { navigation: { name: 'Управление', icon: 'Task' } }
                }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse', softwareBrothers: false }
        });

        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === ADMIN_USER.email && password === ADMIN_USER.password) return ADMIN_USER;
                return null;
            },
            cookieName: 'neural_session',
            cookiePassword: 'super-secret-password-123-long-enough',
        }, null, { resave: false, saveUninitialized: true, secret: 'session_secret' });

        app.use(adminJs.options.rootPath, router);
        console.log(`🔐 [ADMIN] Панель: ${DOMAIN}/admin`);
    } catch (e) { 
        console.error("❌ [ADMIN ERROR]:", e.message); 
    }
};

// Остальные API (get /api/user/:id, post /api/save) остаются без изменений...
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url, ref } = req.query;
    try {
        let result = await pool.query('SELECT *, NOW() as now FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            const refId = (ref && ref !== userId) ? parseInt(ref) : null;
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url, referrer_id) VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, username || 'Agent', photo_url || '', refId]
            );
            if (refId) await pool.query('UPDATE users SET balance = balance + 5000 WHERE id = $1', [refId]);
            return res.json({ ...newUser.rows[0], offlineProfit: 0 });
        }
        const user = result.rows[0];
        const secondsOffline = Math.floor((new Date(user.now) - new Date(user.last_seen)) / 1000);
        const offlineProfit = Math.floor((user.profit / 3600) * Math.min(secondsOffline, 10800));
        res.json({ ...user, offlineProfit });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, tap, profit } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [userId, balance, energy, tap, profit]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save failed" }); }
});

bot.start((ctx) => {
    const webAppUrl = ctx.startPayload ? `${DOMAIN}?ref=${ctx.startPayload}` : DOMAIN;
    ctx.reply(`<b>Neural Pulse | System</b>\nAgent <b>${ctx.from.first_name}</b>, terminal ready.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", webAppUrl)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    await initDB();
    await startAdmin();
    console.log(`🚀 СЕРВЕР: ${DOMAIN}`);
    await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
});
