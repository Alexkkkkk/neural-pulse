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

const pool = new Pool({ connectionString: PG_URI, ssl: false });

// --- ИНИЦИАЛИЗАЦИЯ БД ---
const initDB = async () => {
    try {
        const client = await pool.connect();
        // Пользователи
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
                last_daily_claim TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        
        // Задания
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                reward INTEGER DEFAULT 1000,
                url TEXT,
                category TEXT DEFAULT 'social'
            )`);

        await client.query(`CREATE TABLE IF NOT EXISTS user_tasks (
            user_id BIGINT REFERENCES users(id),
            task_id INTEGER REFERENCES tasks(id),
            PRIMARY KEY (user_id, task_id)
        )`);

        console.log("✅ [DB] Таблицы проверены");
        client.release();
    } catch (e) { console.error("❌ [DB ERROR]:", e.message); }
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const getLevel = (balance) => {
    if (balance < 50000) return { name: 'Bronze', level: 1, next: 50000 };
    if (balance < 250000) return { name: 'Silver', level: 2, next: 250000 };
    if (balance < 1000000) return { name: 'Gold', level: 3, next: 1000000 };
    if (balance < 5000000) return { name: 'Platinum', level: 4, next: 5000000 };
    return { name: 'Diamond', level: 5, next: null };
};

// --- API ---

// 1. Вход в игру (с уровнями и прибылью)
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
            return res.json({ ...newUser.rows[0], offlineProfit: 0, levelInfo: getLevel(0) });
        }

        const user = result.rows[0];
        const secondsOffline = Math.floor((new Date(user.current_server_time) - new Date(user.last_seen)) / 1000);
        const offlineProfit = Math.floor((user.profit / 3600) * Math.min(secondsOffline, 10800)); // Макс за 3 часа

        res.json({ 
            ...user, 
            offlineProfit,
            levelInfo: getLevel(user.balance)
        });
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// 2. Ежедневная награда
app.post('/api/daily-claim', async (req, res) => {
    const { userId } = req.body;
    try {
        const result = await pool.query('SELECT last_daily_claim, NOW() as now FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];
        
        if (user.last_daily_claim) {
            const diff = new Date(user.now) - new Date(user.last_daily_claim);
            if (diff < 24 * 3600 * 1000) {
                return res.status(400).json({ error: "Wait 24h" });
            }
        }

        const reward = 10000; // Фиксированная награда
        await pool.query('UPDATE users SET balance = balance + $1, last_daily_claim = NOW() WHERE id = $2', [reward, userId]);
        res.json({ ok: true, reward });
    } catch (e) { res.status(500).json({ error: "Claim error" }); }
});

// 3. Сохранение данных
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, tap, profit } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [userId, balance, energy, tap, profit]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save error" }); }
});

// --- АДМИНКА ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: { model: { tableName: 'users', connectionOptions: { connectionString: PG_URI, dialect: 'postgres' } }, adapter: AdminJSSql } },
                { resource: { model: { tableName: 'tasks', connectionOptions: { connectionString: PG_URI, dialect: 'postgres' } }, adapter: AdminJSSql } }
            ],
            rootPath: '/admin'
        });
        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => (email === ADMIN_USER.email && password === ADMIN_USER.password) ? ADMIN_USER : null,
            cookieName: 'pulse-session',
            cookiePassword: 'super-secret-password-123',
        }, null, { resave: false, saveUninitialized: true, secret: 'secret' });
        app.use(adminJs.options.rootPath, router);
    } catch (e) { console.error("Admin error:", e.message); }
};

// Бот
bot.start((ctx) => {
    const webAppUrl = ctx.startPayload ? `${DOMAIN}?ref=${ctx.startPayload}` : DOMAIN;
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
