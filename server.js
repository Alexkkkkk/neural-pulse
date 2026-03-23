import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';

// --- ИМПОРТЫ АДМИНКИ ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSql from '@adminjs/sql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. РЕГИСТРАЦИЯ АДАПТЕРА (без динамического импорта, напрямую)
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
app.use(session({
    secret: 'neural_pulse_secret_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, secure: false }
}));
app.use(express.static(path.join(__dirname, 'static')));

const pool = new Pool({ connectionString: PG_URI, ssl: false });

// --- ИНИЦИАЛИЗАЦИЯ БД ---
const initDB = async () => {
    const client = await pool.connect();
    try {
        console.log("🛠 [DB] Проверка таблиц...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY, 
                username TEXT, 
                balance DOUBLE PRECISION DEFAULT 0,  
                energy DOUBLE PRECISION DEFAULT 1000, 
                max_energy INTEGER DEFAULT 1000,  
                tap INTEGER DEFAULT 1, 
                profit INTEGER DEFAULT 0,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("✅ [DB] Таблицы готовы");
    } finally { client.release(); }
};

// --- ЗАПУСК АДМИНКИ ---
const startAdmin = async () => {
    try {
        console.log("⚙️ [ADMIN] Настройка ресурсов...");

        const adminJs = new AdminJS({
            // Вместо databases используем явное перечисление ресурсов
            // Это обходит проблему "no adapters" при сканировании всей БД
            resources: [
                {
                    resource: {
                        model: AdminJSSql.Resource,
                        database: AdminJSSql.Database,
                        tableName: 'users',
                        connectionOptions: {
                            connectionString: PG_URI,
                            dialect: 'postgres'
                        }
                    },
                    options: { 
                        navigation: { name: 'Игроки', icon: 'User' },
                        properties: {
                            id: { isId: true },
                            last_seen: { isVisible: { list: true, show: true, edit: false } }
                        }
                    }
                }
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
                if (email === ADMIN_USER.email && password === ADMIN_USER.password) return ADMIN_USER;
                return null;
            },
            cookieName: 'adminjs_session',
            cookiePassword: 'super-secret-password-longer-than-32-chars-123',
        }, null, { 
            resave: false, 
            saveUninitialized: true, 
            secret: 'session_secret' 
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
            const newUser = await pool.query(
                `INSERT INTO users (id, username) VALUES ($1, $2) RETURNING *`,
                [userId, username || 'Agent']
            );
            return res.json(newUser.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, last_seen=NOW() WHERE id=$1`, 
            [userId, balance, energy]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save error" }); }
});

// --- BOT ---
bot.start((ctx) => {
    ctx.reply(`<b>Neural Pulse | Terminal</b>\nAgent <b>${ctx.from.first_name}</b>, sync complete.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    await initDB();
    await startAdmin();
    console.log(`🚀 [SERVER] Запущен на ${DOMAIN}`);
    await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
});
