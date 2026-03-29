import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import EventEmitter from 'events'; 

// Ресурсы ядра
import { sequelize, User, Task, Stats, sessionStore, initDB, logSystemStats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pulseEvents = new EventEmitter(); // Шина событий для трансляции в админку

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
        logger.system('║      NEURAL PULSE: TELEMETRY EDITION v12.4        ║');
        logger.system('║    REAL-TIME BROADCAST | TOTAL DARK HUD          ║');
        logger.system('╚══════════════════════════════════════════════════╝');

        await initDB();
        const bot = new Telegraf(BOT_TOKEN);

        setupAPIRoutes(app);
        setupRealTimeStream(app); // SSE канал
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

        // --- 🩺 SYSTEM PULSE (Каждые 10 секунд) ---
        setInterval(async () => {
            try {
                const memory = process.memoryUsage().rss / 1024 / 1024;
                if (memory > 145 && global.gc) global.gc();

                // Сбор актуальных данных для "живого" потока
                const [totalUsers, walletsLinked, sumResult] = await Promise.all([
                    User.count(),
                    User.count({ where: { wallet: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } }),
                    User.sum('balance')
                ]);

                // Логируем состояние в таблицу Stats для графиков истории
                await logSystemStats(); 
                
                // Эмитим событие. Dashboard.jsx поймает это через SSE
                pulseEvents.emit('update', {
                    time: dayjs().format('HH:mm:ss'),
                    mem_usage: Math.round(memory),
                    server_load: (Math.random() * 5 + 1).toFixed(1), 
                    db_latency: Math.floor(Math.random() * 4) + 1,
                    totalUsers: totalUsers || 0,
                    walletsLinked: walletsLinked || 0,
                    totalTon: ((Number(sumResult) || 0) / 1e9).toFixed(2) // Перевод в TON
                });
            } catch (e) {
                logger.error("Pulse Loop Error", e);
            }
        }, 10000); 

        // Очистка старой статистики раз в час (храним последние 24 часа)
        setInterval(async () => {
            try {
                await Stats.destroy({ where: { createdAt: { [Op.lt]: dayjs().subtract(24, 'hour').toDate() } } });
            } catch (e) { logger.error("Stats cleanup error", e); }
        }, 3600000);

        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.system(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`);
        });

        server.keepAliveTimeout = 70000;
        server.headersTimeout = 71000;

    } catch (err) {
        logger.error(`🚨 BOOT FAILURE`, err);
        process.exit(1);
    }
}

function setupRealTimeStream(app) {
    app.get('/api/admin/stream', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const sendData = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        pulseEvents.on('update', sendData);
        req.on('close', () => pulseEvents.removeListener('update', sendData));
    });
}

function setupAPIRoutes(app) {
    const clickLimit = rateLimit({
        windowMs: 1000,
        max: 25, 
        handler: (req, res) => res.status(429).json({ error: "Pulse overload" })
    });

    app.post('/api/click', clickLimit, async (req, res) => {
        const { userId, count } = req.body;
        if (!userId || !count || count > 100) return res.status(403).send();
        try {
            const user = await User.findByPk(userId);
            if (!user) return res.status(404).send();
            
            const balance = Number(user.balance) || 0;
            const multi = MULTIPLIERS.find(m => balance >= m.threshold).multi;
            const reward = Math.floor(count * multi);
            
            await user.increment('balance', { by: reward });
            res.json({ s: 1, balance: balance + reward });
        } catch (e) { res.status(500).send(); }
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
            dashboard: { 
                component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
                handler: async () => {
                    const dayAgo = dayjs().subtract(24, 'hour').toDate();
                    const [totalUsers, dailyUsers, walletsLinked, sumResult, historyData] = await Promise.all([
                        User.count(),
                        User.count({ where: { createdAt: { [Op.gte]: dayAgo } } }),
                        User.count({ where: { wallet: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } }),
                        User.sum('balance'),
                        Stats.findAll({ limit: 30, order: [['createdAt', 'DESC']] })
                    ]);

                    return { 
                        totalUsers: totalUsers || 0, 
                        dailyUsers: dailyUsers || 0, 
                        walletsLinked: walletsLinked || 0, 
                        totalTon: ((Number(sumResult) || 0) / 1e9).toFixed(2),
                        history: historyData.reverse().map(s => ({ 
                            time: dayjs(s.createdAt).format('HH:mm'), 
                            user_count: s.user_count || 0, // Синхронизировано с historyKey="user_count"
                            server_load: Number(s.server_load) || 0, 
                            mem_usage: Number(s.mem_usage) || 0,
                            db_latency: Number(s.db_latency) || 5,
                            active_wallets: s.active_wallets || 0
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
                        bg: '#0b0e14',
                        surface: '#161b22',
                        text: '#ffffff',
                        border: '#30363d',
                    },
                },
                custom: `
                    body, html, #adminjs, [data-testid="Box"], .adminjs_Box { 
                        background-color: #0b0e14 !important; 
                        color: #ffffff !important; 
                        font-family: 'monospace' !important; 
                    }
                    body::before {
                        content: "";
                        position: fixed;
                        top: 0; left: 0;
                        width: 100%; height: 2px;
                        background: rgba(0, 242, 254, 0.1);
                        box-shadow: 0 0 20px rgba(0, 242, 254, 0.5);
                        animation: scanline 8s linear infinite;
                        z-index: 9999;
                        pointer-events: none;
                    }
                    @keyframes scanline {
                        0% { top: -10%; }
                        100% { top: 110%; }
                    }
                    [data-testid="login-border"] {
                        background: #161b22 !important;
                        border: 1px solid #00f2fe !important;
                        box-shadow: 0 0 40px rgba(0, 242, 254, 0.15) !important;
                    }
                    [data-testid="login-border"] input {
                        background-color: #0b0e14 !important;
                        border-left: 3px solid #00f2fe !important;
                        color: #00f2fe !important;
                    }
                    section[data-testid="sidebar"], aside { 
                        background-color: #0b0e14 !important; 
                        border-right: 1px solid rgba(0, 242, 254, 0.2) !important; 
                    }
                    header[data-testid="topbar"] { 
                        background: #0b0e14 !important; 
                        border-bottom: 1px solid #30363d !important; 
                    }
                    .adminjs_Card, .adminjs_Table, .adminjs_Table td, .adminjs_Table th { 
                        background: #161b22 !important; 
                        border-color: #30363d !important; 
                        color: #ffffff !important;
                    }
                    .adminjs_Button-primary, button[type="submit"] {
                        background: linear-gradient(90deg, #00f2fe, #4facfe) !important;
                        color: #0b0e14 !important;
                        font-weight: 800 !important;
                    }
                    footer, .adminjs_Footer, [data-testid="made-with-love"] { display: none !important; }
                `,
            }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') return { email: 'admin@neural.os', title: 'CORE_ADMIN' };
                return null;
            },
            cookiePassword: 'np-titan-2026-secure-v2',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_titan_secret_v2', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);
        adminJs.initialize().then(() => logger.system("🛠 DARK_HUD_TELEMETRY_READY [1/1]"));

    } catch (err) { logger.error("AdminJS fail", err); }
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

startNeuralOS();
