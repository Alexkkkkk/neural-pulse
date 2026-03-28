import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dayjs from 'dayjs';

// Ресурсы ядра (БД и логи)
import { sequelize, User, Task, Stats, sessionStore, initDB, logSystemStats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ⚙️ TITAN CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const DASHBOARD_COMPONENT = path.join(__dirname, 'static', 'dashboard.jsx');

const MULTIPLIERS = [
    { threshold: 2000000, multi: 3.5 },
    { threshold: 500000, multi: 2.5 },
    { threshold: 100000, multi: 2.0 },
    { threshold: 10000, multi: 1.5 },
    { threshold: 0, multi: 1.0 }
];

async function startNeuralOS() {
    const app = express();

    // --- 🛡️ ГИБКАЯ ЗАЩИТА (Исправляет белый экран) ---
    app.use(helmet({
        contentSecurityPolicy: false, // Отключаем CSP, так как AdminJS использует инлайн-скрипты
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: false,
    }));
    
    app.use(compression({ level: 6 }));
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '32kb' }));

    app.use('/static', express.static(path.join(__dirname, 'static'), {
        maxAge: '1h',
        etag: true
    }));

    try {
        console.clear();
        logger.system('╔══════════════════════════════════════════════════╗');
        logger.system('║      NEURAL PULSE: SINGLE-CORE TITAN v12.2       ║');
        logger.system('║   FIX: ADMIN-UI READY | MODE: STABLE-FLOW        ║');
        logger.system('╚══════════════════════════════════════════════════╝');

        await initDB();
        const bot = new Telegraf(BOT_TOKEN);

        setupAPIRoutes(app);
        await setupAdminPanel(app);
        setupBotHandlers(bot);

        // ✅ FAIL-SAFE WEBHOOK GATEWAY
        app.post(`/telegraf/${BOT_TOKEN}`, async (req, res) => {
            try {
                if (!req.body || Object.keys(req.body).length === 0) return res.sendStatus(200);
                await bot.handleUpdate(req.body, res);
            } catch (err) {
                logger.error("⚡ Gate Error", err);
            } finally {
                if (!res.headersSent) res.sendStatus(200);
            }
        });

        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, {
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query']
        });

        // --- 🩺 SMART CLEANUP ---
        setInterval(() => {
            const memory = process.memoryUsage().rss / 1024 / 1024;
            if (memory > 220 && global.gc) global.gc();
            logSystemStats();
        }, 120000);

        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.system(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`);
        });

        const shutdown = (signal) => {
            server.close(() => process.exit(0));
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (err) {
        logger.error(`🚨 BOOT FAILURE`, err);
        process.exit(1);
    }
}

function setupAPIRoutes(app) {
    const clickLimit = rateLimit({
        windowMs: 1000,
        max: 15,
        handler: (req, res) => res.status(429).json({ error: "Pulse overload" })
    });

    app.get('/api/health', (req, res) => {
        res.json({
            status: "OPERATIONAL",
            uptime: Math.floor(process.uptime()),
            mem: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
        });
    });

    app.post('/api/click', clickLimit, async (req, res) => {
        const { userId, count } = req.body;
        if (!userId || !count || count > 100 || count <= 0) return res.status(403).send();
        try {
            const user = await User.findByPk(userId, { attributes: ['id', 'balance'] });
            if (!user) return res.status(404).send();
            const multi = MULTIPLIERS.find(m => user.balance >= m.threshold).multi;
            const reward = Math.floor(count * multi);
            await User.increment({ balance: reward }, { where: { id: userId } });
            res.json({ s: 1, balance: parseFloat(user.balance) + reward });
        } catch (e) { res.status(500).send(); }
    });

    app.get('/api/user/:id', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id, { attributes: ['id', 'username', 'balance'], raw: true });
            res.json(user || { error: 404 });
        } catch (e) { res.status(500).send(); }
    });
}

function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        try {
            const [user] = await User.findOrCreate({
                where: { id: ctx.from.id },
                defaults: { username: ctx.from.username || 'AGENT', balance: 0 }
            });
            const webAppUrl = `${DOMAIN}/static/index.html?v=${Date.now()}`;
            const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ: ВХОД", webAppUrl)]]);
            await ctx.reply(`<b>[ NEURAL PULSE ]</b>\n\n<b>АГЕНТ:</b> <code>${user.username}</code>`, { parse_mode: 'HTML', ...keyboard });
        } catch (e) { logger.error("Bot.start fail", e); }
    });
}

async function setupAdminPanel(app) {
    try {
        const { default: AdminJS, ComponentLoader } = await import('adminjs');
        const { default: AdminJSExpress } = await import('@adminjs/express');
        const AdminJSSequelize = await import('@adminjs/sequelize');

        AdminJS.registerAdapter(AdminJSSequelize);
        const componentLoader = new ComponentLoader();
        
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'CORE' }, listProperties: ['id', 'username', 'balance'] } },
                { resource: Task, options: { navigation: { name: 'OS' } } },
                { resource: Stats, options: { navigation: { name: 'OS' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            env: { NODE_ENV: 'production' }, // Ускоряет работу фронта
            dashboard: { 
                component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
                handler: async () => {
                    const totalUsers = await User.count();
                    const latestStats = await Stats.findAll({ limit: 10, order: [['createdAt', 'DESC']] });
                    return { totalUsers, history: latestStats.reverse().map(s => ({ time: dayjs(s.createdAt).format('HH:mm'), cpu: s.server_load, mem: s.mem_usage })) };
                }
            },
            branding: { companyName: 'NEURAL PULSE', softwareBrothers: false },
            bundler: { minify: true } 
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === 'admin' && p === 'neural2026') ? { email: 'admin' } : null,
            cookiePassword: 'np-titan-2026-secure',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_titan_secret', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);
        await adminJs.initialize();
        logger.system("🛠 ADMIN TERMINAL ONLINE");
    } catch (err) { logger.error("AdminJS fail", err); }
}

startNeuralOS();
