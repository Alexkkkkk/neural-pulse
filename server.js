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
import { Op } from 'sequelize'; // Необходим для фильтрации по датам

// Ресурсы ядра
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

    // --- 🛡️ SECURITY & PERFORMANCE ---
    app.use(helmet({
        contentSecurityPolicy: false, 
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: false,
    }));
    
    app.use(compression({ level: 6 }));
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '32kb' }));

    // Раздача статики
    app.use('/static', express.static(path.join(__dirname, 'static'), {
        maxAge: '1h',
        etag: true
    }));

    try {
        console.clear();
        logger.system('╔══════════════════════════════════════════════════╗');
        logger.system('║      NEURAL PULSE: SINGLE-CORE TITAN v12.3       ║');
        logger.system('║   STABLE ADMIN + DARK HUD | LOGIN: 1 / 1         ║');
        logger.system('╚══════════════════════════════════════════════════╝');

        await initDB();
        const bot = new Telegraf(BOT_TOKEN);

        setupAPIRoutes(app);
        await setupAdminPanel(app);
        setupBotHandlers(bot);

        // ✅ WEBHOOK GATEWAY
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

        // --- 🩺 MEMORY GUARD (для 159MB RAM) ---
        setInterval(() => {
            const memory = process.memoryUsage().rss / 1024 / 1024;
            if (memory > 140 && global.gc) {
                logger.system(`♻️ Low memory cleaning: ${Math.round(memory)}MB`);
                global.gc();
            }
            logSystemStats();
        }, 120000);

        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.system(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`);
        });

        server.keepAliveTimeout = 70000;
        server.headersTimeout = 71000;

        process.on('SIGTERM', () => server.close());
        process.on('SIGINT', () => server.close());

    } catch (err) {
        logger.error(`🚨 BOOT FAILURE`, err);
        process.exit(1);
    }
}

function setupAPIRoutes(app) {
    const clickLimit = rateLimit({
        windowMs: 1000,
        max: 20,
        handler: (req, res) => res.status(429).json({ error: "Pulse overload" })
    });

    app.get('/api/health', (req, res) => {
        res.json({ status: "OPERATIONAL", mem: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB` });
    });

    app.post('/api/click', clickLimit, async (req, res) => {
        const { userId, count } = req.body;
        if (!userId || !count || count > 100) return res.status(403).send();
        try {
            const user = await User.findByPk(userId);
            if (!user) return res.status(404).send();
            const multi = MULTIPLIERS.find(m => (user.balance || 0) >= m.threshold).multi;
            const reward = Math.floor(count * multi);
            await user.increment('balance', { by: reward });
            res.json({ s: 1, balance: parseFloat(user.balance) + reward });
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
                { resource: User, options: { navigation: { name: 'CORE' }, listProperties: ['id', 'username', 'balance', 'wallet'] } },
                { resource: Task, options: { navigation: { name: 'OS' } } },
                { resource: Stats, options: { navigation: { name: 'OS' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            env: { NODE_ENV: 'production' },
            dashboard: { 
                component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
                handler: async () => {
                    // --- СБОР ДАННЫХ ДЛЯ КИБЕР-ДАШБОРДА ---
                    const dayAgo = dayjs().subtract(24, 'hour').toDate();
                    
                    const totalUsers = await User.count();
                    
                    // Новые юзеры за 24ч
                    const dailyUsers = await User.count({ 
                        where: { createdAt: { [Op.gte]: dayAgo } } 
                    });

                    // Кошельки (считаем записи, где поле wallet не null и не пустое)
                    const walletsLinked = await User.count({ 
                        where: { wallet: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } 
                    });

                    // TON Баланс (сумма всех балансов, деленная на 10^9 если хранишь в нанотонах)
                    const sumBalance = await User.sum('balance') || 0;
                    const totalTon = (sumBalance / 1000000000).toFixed(2);

                    const latestStats = await Stats.findAll({ limit: 10, order: [['createdAt', 'DESC']] });
                    
                    return { 
                        totalUsers,
                        dailyUsers,
                        walletsLinked,
                        totalTon,
                        history: latestStats.reverse().map(s => ({ 
                            time: dayjs(s.createdAt).format('HH:mm'), 
                            cpu: s.server_load, 
                            mem: s.mem_usage 
                        })) 
                    };
                }
            },
            branding: { 
                companyName: 'NEURAL PULSE', 
                withMadeWithAdminJS: false,
                logo: '/static/images/logo.png',
                theme: {
                    colors: {
                        primary100: '#00f2fe',
                        accent: '#7000ff',
                        bg: '#0b0e14',
                        surface: '#161b22',
                        error: '#ff3131',
                        success: '#39ff14',
                        border: '#30363d',
                        text: '#ffffff',
                    },
                    custom: `
                        /* ТЕМНАЯ ТЕМА TITAN */
                        body, .adminjs_Box { background-color: #0b0e14 !important; color: #ffffff !important; font-family: 'JetBrains Mono', monospace !important; }
                        .adminjs_Card { background: #161b22 !important; border: 1px solid #30363d !important; }
                        .adminjs_Table, .adminjs_TableThead, .adminjs_TableTbody { background: #161b22 !important; }
                        .adminjs_TableCell { color: #ffffff !important; border-bottom: 1px solid #30363d !important; }
                        .adminjs_Button[data-variant="primary"] { background: #00f2fe !important; color: #000 !important; font-weight: bold !important; }
                        
                        /* САЙДБАР */
                        section[data-testid="sidebar"] { background: #0b0e14 !important; border-right: 1px solid #30363d !important; }
                        a[data-testid="sidebar-resource-link"] { color: #8b949e !important; }
                        a[data-testid="sidebar-resource-link"]:hover { color: #00f2fe !important; background: #1c2128 !important; }
                        
                        /* ФИКС ДЛЯ ЧИТАЕМОСТИ ОШИБОК */
                        .adminjs_Message { background: #fff3f3 !important; border: 1px solid #ff3131 !important; color: #000 !important; }
                        .adminjs_Message * { color: #000 !important; } 
                        
                        /* ИНПУТЫ */
                        input, select, textarea { background: #1c2128 !important; color: white !important; border: 1px solid #30363d !important; }
                    `,
                }
            },
            bundler: { 
                minify: true,
                force: false 
            } 
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') {
                    return { email: 'admin@neural.os', title: 'CORE_ADMIN' };
                }
                return null;
            },
            cookiePassword: 'np-titan-2026-secure-v2',
        }, null, { 
            resave: false, 
            saveUninitialized: false, 
            secret: 'np_titan_secret_v2', 
            store: sessionStore 
        });

        app.use(adminJs.options.rootPath, adminRouter);
        
        adminJs.initialize().then(() => {
            logger.system("🛠 DARK_HUD_ONLINE [LOGIN: 1 / PASS: 1]");
        });

    } catch (err) { logger.error("AdminJS fail", err); }
}

startNeuralOS();
