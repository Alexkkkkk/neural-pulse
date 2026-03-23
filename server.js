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

console.log("🚀 [SYSTEM] Инициализация системы...");

// 1. РЕГИСТРАЦИЯ АДАПТЕРА
AdminJS.registerAdapter({
    Database: AdminJSSql.Database,
    Resource: AdminJSSql.Resource,
});
console.log("📦 [SYSTEM] Адаптер AdminJS зарегистрирован");

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
app.use(express.static(path.join(__dirname, 'static')));

const pool = new Pool({ connectionString: PG_URI, ssl: false });

// --- ИНИЦИАЛИЗАЦИЯ БД ---
const initDB = async () => {
    console.log("🛠 [DB] Проверка таблиц...");
    const client = await pool.connect();
    try {
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
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                reward INTEGER DEFAULT 1000,
                url TEXT,
                category TEXT DEFAULT 'social'
            )`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_tasks (
                user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, task_id)
            )`);
        console.log("✅ [DB] Таблицы готовы");
    } catch (e) {
        console.error("❌ [DB ERROR]:", e.message);
    } finally {
        client.release();
    }
};

// --- ЗАПУСК АДМИНКИ ---
const startAdmin = async () => {
    try {
        console.log("⚙️ [ADMIN] Подключение ресурсов...");
        
        const adminJs = new AdminJS({
            // Передаем параметры подключения напрямую в ресурсы
            resources: [
                { 
                    resource: { model: AdminJSSql.Resource, database: AdminJSSql.Database, tableName: 'users' },
                    options: { navigation: { name: 'Игроки', icon: 'User' } }
                },
                { 
                    resource: { model: AdminJSSql.Resource, database: AdminJSSql.Database, tableName: 'tasks' },
                    options: { navigation: { name: 'Система', icon: 'Task' } }
                }
            ],
            // Указываем базу данных для сканирования
            databases: [
                new AdminJSSql.Database({
                    connectionString: PG_URI,
                    dialect: 'postgres'
                })
            ],
            rootPath: '/admin',
            branding: { 
                companyName: 'Neural Pulse Admin', 
                softwareBrothers: false,
                logo: false 
            }
        });

        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
                    console.log(`🔐 [ADMIN] Вход: ${email}`);
                    return ADMIN_USER;
                }
                return null;
            },
            cookieName: 'neural_pulse_session',
            cookiePassword: 'super-long-secure-password-for-cookie-encryption-123',
        }, null, { resave: false, saveUninitialized: true, secret: 'admin_secret' });

        app.use(adminJs.options.rootPath, router);
        console.log(`✅ [ADMIN] Админка готова: ${DOMAIN}/admin`);
    } catch (e) { 
        console.error("❌ [ADMIN ERROR]:", e.message); 
    }
};

// --- API ЭНДПОИНТЫ ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    console.log(`👤 [GET] Данные юзера: ${userId}`);
    try {
        let result = await pool.query('SELECT *, NOW() as now FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            const { username, photo_url, ref } = req.query;
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
        const recoveredEnergy = Math.min(user.max_energy, user.energy + (secondsOffline * 3));
        const offlineProfit = Math.floor((user.profit / 3600) * Math.min(secondsOffline, 10800));

        res.json({ ...user, energy: recoveredEnergy, offlineProfit });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, tap, profit } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [userId, balance, energy, tap, profit]
        );
        console.log(`💾 [SAVE] ID ${userId} | Bal: ${balance}`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save error" }); }
});

// --- BOT ---
bot.start((ctx) => {
    console.log(`🤖 [BOT] Start от ${ctx.from.id}`);
    const webAppUrl = ctx.startPayload ? `${DOMAIN}?ref=${ctx.startPayload}` : DOMAIN;
    ctx.reply(`<b>Neural Pulse | Terminal</b>\nAgent <b>${ctx.from.first_name}</b>, sync complete.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", webAppUrl)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    await initDB();
    await startAdmin();
    console.log(`🚀 [SERVER] Запущен: ${DOMAIN}`);
    await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
});
