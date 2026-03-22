import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';

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

// Встроенный CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const pool = new Pool({ connectionString: PG_URI, ssl: false });

// --- ИНИЦИАЛИЗАЦИЯ БД ---
const initDB = async () => {
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
        console.log("✅ [DB] Таблица users готова");
        client.release();
    } catch (e) { console.error("❌ [DB ERROR]:", e.message); }
};

// --- АДМИН-ПАНЕЛЬ ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [{
                resource: {
                    adapter: AdminJSSql,
                    model: { tableName: 'users', connectionOptions: { connectionString: PG_URI, dialect: 'postgres' } }
                },
                options: {
                    navigation: { name: 'Игроки', icon: 'User' },
                    properties: {
                        id: { isId: true, isTitle: true },
                        last_seen: { isVisible: { list: true, edit: false, filter: true, show: true } }
                    }
                }
            }],
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
        }, null, { resave: false, saveUninitialized: true, secret: 'session-secret' });

        app.use(adminJs.options.rootPath, router);
    } catch (error) { console.error("❌ [ADMIN ERROR]:", error.message); }
};

// --- API ЭНДПОИНТЫ ---

// Получение данных игрока + Рефералка + Offline Profit
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url, ref } = req.query;
    
    try {
        let result = await pool.query('SELECT *, NOW() as current_time FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            // НОВЫЙ ПОЛЬЗОВАТЕЛЬ
            const refId = (ref && ref !== userId) ? parseInt(ref) : null;
            
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url, referrer_id) VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '', refId]
            );

            // Если есть реферер - даем ему бонус
            if (refId) {
                await pool.query('UPDATE users SET balance = balance + 5000 WHERE id = $1', [refId]);
            }
            
            return res.json({ ...newUser.rows[0], offlineProfit: 0 });
        }

        // СУЩЕСТВУЮЩИЙ ПОЛЬЗОВАТЕЛЬ (Расчет Offline прибыли)
        const user = result.rows[0];
        const lastSeen = new Date(user.last_seen);
        const now = new Date(user.current_time);
        const secondsOffline = Math.floor((now - lastSeen) / 1000);
        
        // Начисляем прибыль (макс. за 3 часа отсутствия)
        const cappedSeconds = Math.min(secondsOffline, 3 * 3600);
        const offlineProfit = Math.floor((user.profit / 3600) * cappedSeconds);

        res.json({ ...user, offlineProfit });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, tap, profit } = req.body;
    try {
        if (balance < 0) return res.status(400).json({ error: "Invalid balance" });
        
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [userId, balance, energy, tap, profit]
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
    
    ctx.reply(`<b>Neural Pulse | Sync Active</b>\n\nWelcome, Agent <b>${ctx.from.first_name}</b>.\nYour terminal is ready for operation.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", webAppUrl)],
            [Markup.button.url("📢 Канал проекта", "https://t.me/your_channel")]
        ])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    await initDB();
    await startAdmin();
    console.log(`🚀 СЕРВЕР ЗАПУЩЕН: ${DOMAIN}`);
    await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
});
