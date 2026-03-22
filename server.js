import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

// --- ПАКЕТЫ АДМИНКИ ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSql from '@adminjs/sql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const pool = new Pool({ 
    connectionString: PG_URI, 
    ssl: false,
    max: 20
});

// --- ИНИЦИАЛИЗАЦИЯ БД ---
const initDB = async () => {
    try {
        const client = await pool.connect();
        // Таблица пользователей
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
        
        // Таблица заданий
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                reward INTEGER DEFAULT 1000,
                url TEXT,
                category TEXT DEFAULT 'social'
            )`);

        // Выполненные задания
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_tasks (
                user_id BIGINT REFERENCES users(id),
                task_id INTEGER REFERENCES tasks(id),
                PRIMARY KEY (user_id, task_id)
            )`);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance DESC)`);
        console.log("✅ [DB] Структура базы данных обновлена");
        client.release();
    } catch (e) { console.error("❌ [DB ERROR]:", e.message); }
};

// --- АДМИНКА ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                {
                    resource: { model: { tableName: 'users', connectionOptions: { connectionString: PG_URI, dialect: 'postgres' } }, adapter: AdminJSSql },
                    options: { navigation: { name: 'Игроки', icon: 'User' } }
                },
                {
                    resource: { model: { tableName: 'tasks', connectionOptions: { connectionString: PG_URI, dialect: 'postgres' } }, adapter: AdminJSSql },
                    options: { navigation: { name: 'Задания', icon: 'Checkmark' } }
                }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse Admin', softwareBrothers: false }
        });

        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === ADMIN_USER.email && password === ADMIN_USER.password) return ADMIN_USER;
                return null;
            },
            cookieName: 'adminjs-session',
            cookiePassword: 'super-secret-password-123',
        }, null, { resave: false, saveUninitialized: true, secret: 'secret' });

        app.use(adminJs.options.rootPath, router);
    } catch (error) { console.error("❌ [ADMIN ERROR]:", error.message); }
};

// --- API ---

// 1. Загрузка данных + Offline Profit
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url, ref } = req.query;
    try {
        let result = await pool.query('SELECT *, NOW() as current_server_time FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            const refId = (ref && ref !== userId) ? parseInt(ref) : null;
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url, referrer_id) VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '', refId]
            );
            if (refId) await pool.query('UPDATE users SET balance = balance + 5000 WHERE id = $1', [refId]);
            return res.json({ ...newUser.rows[0], offlineProfit: 0, isNew: true });
        }

        const user = result.rows[0];
        const secondsOffline = Math.floor((new Date(user.current_server_time) - new Date(user.last_seen)) / 1000);
        const offlineProfit = Math.floor((user.profit / 3600) * Math.min(secondsOffline, 3 * 3600));

        res.json({ ...user, offlineProfit });
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// 2. Сохранение
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

// 3. Список заданий
app.get('/api/tasks/:userId', async (req, res) => {
    try {
        const tasks = await pool.query(`
            SELECT t.*, (ut.user_id IS NOT NULL) as completed
            FROM tasks t
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.user_id = $1
        `, [req.params.userId]);
        res.json(tasks.rows);
    } catch (e) { res.status(500).json({ error: "Tasks error" }); }
});

// 4. Выполнение задания
app.post('/api/tasks/complete', async (req, res) => {
    const { userId, taskId } = req.body;
    try {
        const check = await pool.query('SELECT * FROM user_tasks WHERE user_id=$1 AND task_id=$2', [userId, taskId]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Already completed" });

        const task = await pool.query('SELECT reward FROM tasks WHERE id=$1', [taskId]);
        if (task.rows.length === 0) return res.status(404).json({ error: "Task not found" });

        await pool.query('INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)', [userId, taskId]);
        await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [task.rows[0].reward, userId]);
        
        res.json({ ok: true, reward: task.rows[0].reward });
    } catch (e) { res.status(500).json({ error: "Completion error" }); }
});

app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: "Top error" }); }
});

// --- БОТ ---
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
    await initDB();
    await startAdmin();
    console.log(`🚀 СЕРВЕР: ${DOMAIN}`);
    await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
});
