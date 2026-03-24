import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes, Op } from 'sequelize';
import os from 'os';

import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- [STARTUP] Initialization started ---');

AdminJS.registerAdapter(AdminJSSequelize);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- СЕРВЕРНЫЕ НАСТРОЙКИ (ФИКС ОШИБКИ TRUST) ---
console.log('--- [CONFIG] Setting trust proxy to true ---');
app.set('trust proxy', true); 

app.use(cors());
app.use(express.json());

// Middleware для логирования всех входящих HTTP запросов
app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.url} | IP: ${req.ip}`);
    next();
});

// Настройка сессий
app.use(session({
    secret: 'neural_pulse_ultra_secret_2026',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
        secure: true, 
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

app.use(express.static(path.join(__dirname, 'static')));

const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: (msg) => console.log(`[DB LOG] ${msg}`), 
    dialectOptions: { ssl: false } 
});

// --- МОДЕЛИ ---
const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: false },
    username: { type: DataTypes.STRING },
    photo_url: { type: DataTypes.TEXT },
    balance: { type: DataTypes.DOUBLE, defaultValue: 0 },
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    profit: { type: DataTypes.INTEGER, defaultValue: 0 },
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_bonus: { type: DataTypes.DATE },
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false });

const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false, unique: true },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING }
}, { timestamps: false });

const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    timestamp: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    user_count: { type: DataTypes.INTEGER },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    db_response_time: { type: DataTypes.INTEGER }
}, { timestamps: false });

// --- API ---

app.get('/api/user/:id', async (req, res) => {
    console.log(`[API] GET User request for ID: ${req.params.id}`);
    const userId = req.params.id;
    const { username, photo_url } = req.query;
    try {
        let user = await User.findByPk(userId);
        if (!user) {
            console.log(`[API] Creating new user: ${userId}`);
            user = await User.create({
                id: userId,
                username: username || 'AGENT',
                photo_url: photo_url || ''
            });
        }
        res.json(user);
    } catch (e) { 
        console.error("[API ERROR] Load User:", e);
        res.status(500).send("DB Error"); 
    }
});

app.post('/api/save', async (req, res) => {
    const d = req.body;
    console.log(`[API] SAVE request for ID: ${d.id}`);
    if (!d.id) return res.status(400).send("No ID");
    try {
        await User.update({
            balance: d.balance,
            energy: d.energy,
            max_energy: d.max_energy,
            tap: d.tap,
            profit: d.profit,
            tap_lvl: d.tap_lvl,
            mine_lvl: d.mine_lvl,
            energy_lvl: d.energy_lvl,
            last_bonus: d.last_bonus,
            last_seen: new Date()
        }, { where: { id: d.id } });
        res.json({ ok: true });
    } catch (e) { 
        console.error("[API ERROR] Save:", e);
        res.status(500).send("Save Error"); 
    }
});

// --- АДМИНКА ---
const startAdmin = async () => {
    console.log('--- [ADMIN] Starting AdminJS setup ---');
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Players', icon: 'User' } } },
                { resource: Task, options: { navigation: { name: 'Quests', icon: 'Checklist' } } },
                { resource: Stats, options: { navigation: { name: 'Metrics', icon: 'Activity' } } }
            ],
            rootPath: '/admin',
            branding: { 
                companyName: 'Neural Pulse Control',
                logo: '/images/logo.png',
                withMadeWithLove: false
            }
        });

        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                console.log(`[ADMIN AUTH] Attempt with login: ${email}`);
                if (email === '1' && password === '1') {
                    console.log('[ADMIN AUTH] Success for login 1');
                    return { email: 'admin@pulse.com' };
                }
                console.log('[ADMIN AUTH] Failed');
                return null;
            },
            cookieName: 'adminjs_session',
            cookiePassword: 'secure-cookie-password-2026-v2',
        }, null, { 
            resave: false, 
            saveUninitialized: false, 
            secret: 'session_secret',
            proxy: true,
            cookie: { secure: true }
        });

        app.use(adminJs.options.rootPath, router);
        console.log(`--- [ADMIN] AdminJS panel ready at ${DOMAIN}/admin ---`);
    } catch (e) { 
        console.error(`--- [ADMIN ERROR] Initialization failed:`, e); 
    }
};

// --- МОНИТОРИНГ ---
const collectMetrics = async () => {
    try {
        const startDb = Date.now();
        const userCount = await User.count();
        const dbTime = Date.now() - startDb;
        const memUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const cpuLoad = (os.loadavg()[0] * 10).toFixed(2);

        await Stats.create({
            user_count: userCount,
            server_load: parseFloat(cpuLoad),
            mem_usage: parseFloat(memUsed),
            db_response_time: dbTime
        });
        console.log(`[METRICS] Recorded: Users: ${userCount}, Mem: ${memUsed}MB`);
    } catch (e) { console.log("[METRICS ERROR] Failed to collect metrics"); }
};

// --- БОТ ЛОГИКА ---
bot.start(async (ctx) => {
    console.log(`[BOT] Start command from user: ${ctx.from.id}`);
    const userId = ctx.from.id;
    const startPayload = ctx.startPayload;

    if (startPayload && startPayload != userId) {
        try {
            const referrer = await User.findByPk(startPayload);
            if (referrer) {
                await User.update(
                    { balance: referrer.balance + 5000, referrals: referrer.referrals + 1 },
                    { where: { id: startPayload } }
                );
                console.log(`[BOT] Referral reward given to: ${startPayload}`);
            }
        } catch (e) { console.log("[BOT ERROR] Referral processing failed"); }
    }

    ctx.replyWithPhoto({ source: path.join(__dirname, 'static/images/logo.png') }, {
        caption: `<b>Neural Pulse | Terminal</b>\n\nДобро пожаловать, Агент. Твоя нейросеть готова к работе.`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)],
            [Markup.button.url("📢 КАНАЛ", "https://t.me/neural_pulse_news")]
        ])
    }).catch((err) => {
        console.error("[BOT ERROR] Photo reply failed, sending text only:", err.message);
        ctx.reply(`<b>Neural Pulse | Terminal</b>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
        });
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- ЗАПУСК ---
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`--- [SERVER] Listening on ${DOMAIN} (Port: ${PORT}) ---`);
    try {
        console.log('[DB] Connecting to Postgres...');
        await sequelize.authenticate();
        console.log('[DB] Connection has been established successfully.');
        
        await sequelize.sync({ alter: true }); 
        console.log('[DB] Models synced.');

        await startAdmin();

        console.log('[BOT] Setting Telegram webhook...');
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        console.log('[BOT] Webhook is set.');
        
        setInterval(collectMetrics, 15 * 60 * 1000); 
        collectMetrics();

        console.log(`🚀 [SYSTEM ONLINE] Initialization complete.`);
    } catch (err) { 
        console.error("!!! [STARTUP FAILURE] !!!", err); 
    }
});
