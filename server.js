import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import OpenAI from 'openai';
import helmet from 'helmet';
import compression from 'compression';

// 1. Импорты БД и логов
import { sequelize, User, Task, Stats, sessionStore, initDB, logSystemStats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const DASHBOARD_COMPONENT = path.join(__dirname, 'static', 'dashboard.jsx');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-...' });

const calculateLevel = (balance) => {
    const b = parseFloat(balance);
    if (b < 10000) return 1;
    if (b < 100000) return 2;
    if (b < 500000) return 3;
    if (b < 2000000) return 4;
    return 5;
};

async function startNeuralOS() {
    const app = express();

    // --- СИСТЕМНЫЕ ОПТИМИЗАЦИИ ---
    app.use(helmet({ contentSecurityPolicy: false })); // Защита заголовков
    app.use(compression()); // Сжатие трафика
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '10mb' }));
    
    // Статика
    app.use('/static', express.static(path.join(__dirname, 'static')));

    // ✅ УЛЬТИМАТИВНЫЙ HEALTH CHECK
    app.get('/api/health', (req, res) => {
        const memory = process.memoryUsage();
        res.status(200).json({
            status: 'pulse_online',
            uptime: Math.floor(process.uptime()),
            ram_usage: `${Math.round(memory.rss / 1024 / 1024)}MB`,
            node_version: process.version
        });
    });

    try {
        logger.system('══════════════════════════════════════════════════');
        logger.system('🚀 NEURAL PULSE: SINGLE CORE ENGINE ACTIVE');
        logger.system('⚙️  MODE: FULL INTEGRATION (BOT + ADMIN + API)');
        logger.system('══════════════════════════════════════════════════');

        await initDB();
        const bot = new Telegraf(BOT_TOKEN);

        // --- WEBHOOK ENDPOINT ---
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
            bot.handleUpdate(req.body, res).catch((err) => {
                logger.error("Telegraf Update Error", err);
                if (!res.headersSent) res.sendStatus(200);
            });
        });

        // 1. Инициализация API
        setupAPIRoutes(app);

        // 2. Инициализация AdminJS
        await setupAdminPanel(app);

        // 3. Настройка логики бота
        setupBotHandlers(bot);

        // 4. Запуск Webhook
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, { 
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query', 'web_app_data']
        });

        // Интервал логирования характеристик системы
        setInterval(() => logSystemStats(), 60000);

        // Обработка 404
        app.use((req, res) => {
            res.status(404).json({ error: "Neural Pulse: Interface not found" });
        });

        app.listen(PORT, '0.0.0.0', () => {
            logger.system(`✅ CORE ONLINE ON PORT ${PORT}`);
        });

    } catch (err) {
        logger.error(`🚨 CRITICAL SYSTEM FAILURE`, err);
        process.exit(1);
    }
}

// --- МОДУЛЬ 1: БОТ-ИНТЕРФЕЙС ---
function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        const userId = ctx.from.id;
        const webAppUrl = `${DOMAIN}/static/index.html`;
        const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", webAppUrl)]]);

        try {
            let user = await User.findByPk(userId);
            if (!user) {
                user = await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: 0 });
            }
            const caption = `<b>Neural Pulse | Hub</b>\n\nАгент: <code>${user.username}</code>\nСтатус: <b>Active</b>\nБаланс: <b>${user.balance.toLocaleString()} NP</b>`;
            const logoPath = path.join(__dirname, 'static/images/logo.png');

            if (fs.existsSync(logoPath)) await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
            else await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
        } catch (e) { logger.error(`Bot Fail`, e); }
    });
}

// --- МОДУЛЬ 2: API КОНТРОЛЛЕР ---
function setupAPIRoutes(app) {
    app.get('/api/user/:id', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ error: 'Agent not found' });
            res.json(user);
        } catch (e) { res.status(500).json({ error: 'Internal Error' }); }
    });

    app.post('/api/click', async (req, res) => {
        const { userId, count } = req.body;
        if (!userId || !count) return res.status(400).send();
        try {
            const user = await User.findByPk(userId);
            if (user) {
                const power = 1 + (calculateLevel(user.balance) * 0.5);
                user.balance = parseFloat(user.balance) + (count * power);
                await user.save();
                res.json({ balance: user.balance });
            }
        } catch (e) { res.status(500).send(); }
    });
}

// --- МОДУЛЬ 3: АДМИН-ЦЕНТР ---
async function setupAdminPanel(app) {
    try {
        const { default: AdminJS, ComponentLoader } = await import('adminjs');
        const { default: AdminJSExpress } = await import('@adminjs/express');
        const AdminJSSequelize = await import('@adminjs/sequelize');

        AdminJS.registerAdapter(AdminJSSequelize);
        const componentLoader = new ComponentLoader();
        const DASHBOARD = componentLoader.add('Dashboard', DASHBOARD_COMPONENT);
        
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Персонал' } } },
                { resource: Task, options: { navigation: { name: 'Миссии' } } },
                { resource: Stats, options: { navigation: { name: 'Аналитика' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: {
                component: DASHBOARD,
                handler: async () => {
                    const totalUsers = await User.count();
                    const latest = (await Stats.findOne({ order: [['createdAt', 'DESC']] })) || {};
                    return { totalUsers, cpu: latest.server_load || 0, currentMem: latest.mem_usage || 0 };
                }
            },
            branding: { 
                companyName: 'Neural Pulse Hub',
                logo: '/static/images/logo.png',
                softwareBrothers: false,
                theme: { colors: { primary100: '#00f2ff', accent: '#00f2ff', bg: '#0b0e14' } }
            },
            bundler: { minify: true, force: false } 
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === 'admin' && p === 'neural2026') ? { email: 'admin' } : null,
            cookiePassword: 'secure-session-pulse-unique-2026',
        }, null, { 
            resave: false, 
            saveUninitialized: false, 
            secret: 'np_secret_key_v7', 
            store: sessionStore 
        });

        app.use(adminJs.options.rootPath, adminRouter);
        await adminJs.initialize();
        logger.system("🛠 ADMIN INTERFACE READY");
    } catch (err) { logger.error("AdminJS Initialization fail", err); }
}

// Launch System
startNeuralOS();
