import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Sequelize, DataTypes, Op } from 'sequelize';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

// AdminJS (v7+) - Критически важные импорты для ESM
import AdminJS, { ComponentLoader } from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Регистрация адаптера БД
AdminJS.registerAdapter(AdminJSSequelize);

// --- ИНИЦИАЛИЗАЦИЯ COMPONENT LOADER ---
const componentLoader = new ComponentLoader();
const dashboardPath = path.join(__dirname, 'dashboard.jsx');
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', dashboardPath);

// --- СУПЕР-ЛОГГЕР ---
const logger = {
    info: (msg, meta = '') => console.log(`[${new Date().toLocaleString()}] 🔵 INFO: ${msg}`, meta),
    system: (msg) => console.log(`[${new Date().toLocaleString()}] 🚀 SYSTEM: ${msg}`),
    warn: (msg, meta = '') => console.log(`[${new Date().toLocaleString()}] 🟡 WARN: ${msg}`, meta),
    error: (msg, err) => {
        console.error(`[${new Date().toLocaleString()}] 🔴 ERROR: ${msg}`);
        if (err) console.error("--- Stack Trace Start ---\n", err, "\n--- Stack Trace End ---");
    },
    http: (req, res, next) => {
        const requestId = uuidv4().split('-')[0];
        const start = Date.now();
        if (req.url.startsWith('/api')) logger.info(`REQ [${requestId}] ${req.method} ${req.url}`);
        res.on('finish', () => {
            if (req.url.startsWith('/api')) {
                const duration = Date.now() - start;
                const statusColor = res.statusCode >= 400 ? '🔴' : '🟢';
                console.log(`[${new Date().toLocaleString()}] ${statusColor} RES [${requestId}] ${res.statusCode} | ${duration}ms`);
            }
        });
        next();
    }
};

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;
const OPENAI_KEY = "твой_ключ_здесь"; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Глобальный перехват ошибок
process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection', reason));
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err);
    setTimeout(() => process.exit(1), 1000);
});

// --- MIDDLEWARES ---
app.disable('x-powered-by'); 
app.set('trust proxy', 1);
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(logger.http); 

app.use(express.static(path.join(__dirname, 'static'), { 
    maxAge: '30d', 
    immutable: true
}));

// --- БАЗА ДАННЫХ ---
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false,
    dialectOptions: { ssl: false },
    pool: { max: 30, min: 5 }
});

// --- MODELS ---
const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    username: { type: DataTypes.STRING },
    photo_url: { type: DataTypes.TEXT },
    balance: { type: DataTypes.DOUBLE, defaultValue: 0 },
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    profit: { type: DataTypes.DOUBLE, defaultValue: 0 }, 
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
    referred_by: { type: DataTypes.BIGINT, allowNull: true },
    completed_tasks: { type: DataTypes.JSONB, defaultValue: [] },
    wallet: { type: DataTypes.STRING, allowNull: true },
    last_bonus: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    // Системные колонки для корректной работы Timestamps в PostgreSQL
    createdAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW, allowNull: true },
    updatedAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW, allowNull: true }
}, { timestamps: true });

const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, unique: true },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING }
}, { timestamps: false });

const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_count: { type: DataTypes.INTEGER },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    timestamp: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false });

const calculateLevel = (b) => b < 50000 ? 1 : b < 500000 ? 2 : 3;

// --- API ---
app.get('/api/top', async (req, res) => {
    try {
        const topUsers = await User.findAll({ limit: 50, order: [['balance', 'DESC']], attributes: ['username', 'balance', 'level', 'photo_url'], raw: true });
        res.json(topUsers);
    } catch (e) { res.status(500).json([]); }
});

app.get('/api/user/:id', async (req, res) => {
    try {
        const userId = BigInt(req.params.id);
        const user = await User.findByPk(userId);
        if (!user) return res.json(await User.create({ id: userId, username: req.query.username || 'AGENT' }));
        res.json(user);
    } catch (e) { res.status(500).json({ error: "CORE_ERROR" }); }
});

app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        if (data.balance !== undefined) data.level = calculateLevel(data.balance);
        // Обновляем данные и помечаем updatedAt
        await User.update({ ...data, last_seen: new Date(), updatedAt: new Date() }, { where: { id: BigInt(id) } });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "SAVE_ERROR" }); }
});

// --- ADMINJS ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Агенты', icon: 'User' } } }, 
                { resource: Task, options: { navigation: { name: 'Миссии', icon: 'Task' } } }, 
                { resource: Stats, options: { navigation: { name: 'Система', icon: 'Settings' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            branding: { companyName: 'Neural Pulse Hub', logo: false, softwareBrothers: false },
            dashboard: {
                handler: async () => {
                    const start = Date.now();
                    await sequelize.query('SELECT 1');
                    const latency = Date.now() - start;
                    const totalUsers = await User.count();
                    const last24h = await User.count({
                        where: { createdAt: { [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
                    });

                    return {
                        totalUsers,
                        newUsers24h: last24h,
                        currentMem: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
                        dbLatency: latency,
                        cpu: (os.loadavg()[0] * 10).toFixed(1)
                    };
                },
                component: DASHBOARD_COMPONENT,
            }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse',
        }, null, {
            resave: false, saveUninitialized: false, secret: 'neural_pulse_secret_2026',
            cookie: { maxAge: 86400000, secure: false }
        });
        
        app.use(adminJs.options.rootPath, adminRouter);
    } catch (e) { logger.error("Admin Boot Failure", e); }
};

// --- TELEGRAM BOT ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const logoPath = path.join(__dirname, 'static/images/logo.png');
    try {
        let user = await User.findByPk(userId);
        if (!user) {
            user = await User.create({ id: userId, username: ctx.from.username || 'AGENT' });
        }
        ctx.replyWithPhoto({ source: logoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nИдентификация пройдена.\nАгент: <code>${ctx.from.username || userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]])
        });
    } catch (e) { logger.error(`Bot Error`, e); }
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- ENGINE START ---
const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
        logger.system('--- NEURAL PULSE ENGINE STARTING ---');
        await sequelize.authenticate();
        
        // Синхронизация с обработкой существующих данных
        await sequelize.sync({ alter: true }).catch(err => {
            logger.warn("Sync Alter failed, trying simple sync", err.message);
            return sequelize.sync();
        });

        await startAdmin(); 
        
        setInterval(async () => {
            try {
                const uCount = await User.count();
                await Stats.create({
                    user_count: uCount,
                    server_load: os.loadavg()[0],
                    mem_usage: (os.totalmem() - os.freemem()) / 1024 / 1024 / 1024
                });
            } catch (e) { console.log("Stats error"); }
        }, 900000);

        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        logger.system(`ENGINE: READY (Port ${PORT})`);
    } catch (err) { logger.error("CRITICAL ENGINE BOOTSTRAP FAILURE", err); }
});

// Завершение работы
const shutdown = async () => {
    logger.info("Shutdown signal received");
    server.close(async () => { 
        await sequelize.close(); 
        process.exit(0); 
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
