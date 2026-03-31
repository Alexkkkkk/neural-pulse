import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dayjs from 'dayjs';
import EventEmitter from 'events'; 
import os from 'os';

// Ресурсы ядра из db.js
import { sequelize, User, Task, Stats, GlobalStats, sessionStore, initDB, Op } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pulseEvents = new EventEmitter(); 
pulseEvents.setMaxListeners(30); 

// --- 🛠 СИСТЕМА ЛОГИРОВАНИЯ ---
const neuralLog = (msg, type = 'INFO') => {
    const time = dayjs().format('HH:mm:ss');
    const icons = { INFO: '🔹', WARN: '⚠️', ERROR: '🚨', CORE: '⚡', NET: '🌐', SUCCESS: '✅' };
    console.log(`${icons[type] || '▪️'} [${time}] ${msg}`);
};

// --- ⚙️ CONFIG ---
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
    neuralLog('BOOTING_NEURAL_OS_INIT...', 'CORE');
    const app = express();
    const bot = new Telegraf(BOT_TOKEN);

    // --- 🛡️ SECURITY & MIDDLEWARE ---
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "connect-src": ["'self'", DOMAIN, "https://*.telegram.org", "https://*.tonconnect.org"],
                "img-src": ["'self'", "data:", "https:"],
                "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                "font-src": ["'self'", "https://fonts.gstatic.com"],
                "media-src": ["'self'", "data:", "blob:"] 
            },
        },
        crossOriginEmbedderPolicy: false,
    }));
    
    app.use(compression({ level: 6 }));
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '32kb' }));

    // Статика
    app.use('/static', express.static(path.join(__dirname, 'static'), {
        maxAge: '1h',
        etag: true
    }));

    try {
        neuralLog('Core: Syncing Database...', 'CORE');
        await initDB();
        
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });
        
        setupAPIRoutes(app);
        setupAdminCommands(app, bot);
        setupRealTimeStream(app); 
        
        // Асинхронная загрузка админки (не блокирует бота)
        neuralLog('Core: Initializing Admin Interface...', 'CORE');
        setupAdminPanel(app).then(() => {
            neuralLog('Admin Interface ready.', 'SUCCESS');
            if (global.gc) global.gc(); 
        }).catch(e => neuralLog(`Admin Init Minor Error: ${e.message}`, 'WARN'));

        setupBotHandlers(bot);

        // ✅ WEBHOOK GATEWAY
        app.post(`/telegraf/${BOT_TOKEN}`, async (req, res) => {
            try {
                if (!req.body || Object.keys(req.body).length === 0) return res.sendStatus(200);
                await bot.handleUpdate(req.body, res);
            } catch (err) {
                neuralLog(`Telegraf Error: ${err.message}`, 'ERROR');
            } finally {
                if (!res.headersSent) res.sendStatus(200);
            }
        });

        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, {
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query']
        });
        neuralLog(`Webhook online.`, 'SUCCESS');

        // --- 🩺 SYSTEM PULSE (TELEMETRY) ---
        setInterval(async () => {
            try {
                const startTime = Date.now();
                const mem = process.memoryUsage().rss / 1024 / 1024;
                const load = os.loadavg()[0];

                const [gStats, walletCount] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.count({ where: { wallet: { [Op.not]: null } } })
                ]);

                const pulseData = {
                    time: dayjs().format('HH:mm:ss'),
                    mem_usage: Math.round(mem),
                    server_load: parseFloat(load.toFixed(2)), 
                    user_count: gStats?.total_users || 0,
                    active_wallets: walletCount || 0,
                    total_balance: parseFloat(gStats?.total_balance || 0),
                    db_latency: Date.now() - startTime,
                    recent_event: 'HEARTBEAT_OK',
                    event_type: 'SYSTEM'
                };

                pulseEvents.emit('update', pulseData);
                await Stats.create(pulseData);
            } catch (e) { neuralLog(`Pulse skip: ${e.message}`, 'WARN'); }
        }, 45000); // Интервал 45 сек для снижения нагрузки

        // --- 🌐 SPA FALLBACK ---
        app.get('*', (req, res, next) => {
            if (req.url.startsWith('/api') || req.url.startsWith('/admin') || req.url.startsWith('/telegraf') || req.url.startsWith('/static')) {
                return next();
            }
            res.sendFile(path.resolve(__dirname, 'static', 'index.html'));
        });

        app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`✅ TITAN CORE ACTIVE [PORT: ${PORT}]`, 'SUCCESS');
        });

    } catch (err) {
        neuralLog(`🚨 CRITICAL BOOT FAILURE: ${err.message}`, 'ERROR');
        process.exit(1);
    }
}

// --- 🛰️ ADMIN COMMANDS ---
function setupAdminCommands(app, bot) {
    app.post('/api/admin/command', async (req, res) => {
        try {
            const { action, message } = req.body;
            if (action === 'broadcast' && message) {
                const users = await User.findAll({ attributes: ['id'] });
                for (const user of users) {
                    bot.telegram.sendMessage(user.id, `<b>[ SYSTEM ]</b>\n${message}`, { parse_mode: 'HTML' }).catch(()=>{});
                }
                return res.json({ success: true });
            }
            res.sendStatus(200);
        } catch (e) { res.status(500).send(e.message); }
    });
}

function setupRealTimeStream(app) {
    app.get('/api/admin/stream', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        const sendData = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        pulseEvents.on('update', sendData);
        req.on('close', () => pulseEvents.removeListener('update', sendData));
    });
}

function setupAPIRoutes(app) {
    app.post('/api/click', rateLimit({ windowMs: 1000, max: 25 }), async (req, res) => {
        const { userId, count } = req.body;
        if (!userId || count > 100) return res.status(403).send();
        try {
            const user = await User.findByPk(userId);
            if (!user) return res.status(404).send();
            const reward = Math.floor(count * (MULTIPLIERS.find(m => user.balance >= m.threshold)?.multi || 1));
            await Promise.all([
                user.increment('balance', { by: reward }),
                GlobalStats.increment('total_balance', { by: reward, where: { id: 1 } })
            ]);
            res.json({ balance: parseFloat(user.balance) + reward });
        } catch (e) { res.status(500).send(); }
    });
}

async function setupAdminPanel(app) {
    const { default: AdminJS, ComponentLoader } = await import('adminjs');
    const { default: AdminJSExpress } = await import('@adminjs/express');
    const { default: AdminJSSequelize } = await import('@adminjs/sequelize');

    AdminJS.registerAdapter(AdminJSSequelize);
    const componentLoader = new ComponentLoader();
    
    const adminJs = new AdminJS({
        resources: [
            { resource: User, options: { navigation: { name: 'DATABASE' } } },
            { resource: Stats, options: { navigation: { name: 'SYSTEM' } } },
            { resource: GlobalStats, options: { navigation: { name: 'DATABASE' } } }
        ],
        rootPath: '/admin',
        componentLoader,
        bundler: { isProduction: true, minify: true }, 
        dashboard: { 
            component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
            handler: async () => {
                const [gs, history] = await Promise.all([
                    GlobalStats.findByPk(1),
                    Stats.findAll({ limit: 15, order: [['created_at', 'DESC']] })
                ]);
                return { totalUsers: gs?.total_users, totalBalance: gs?.total_balance, history: history.reverse() };
            }
        },
        branding: { 
            companyName: 'NEURAL PULSE', 
            withMadeWithAdminJS: false,
            theme: { colors: { primary100: '#00f2fe' } }
        }
    });

    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate: async (email, password) => (email === '1' && password === '1' ? { email } : null),
        cookiePassword: 'np-titan-crypt-v5',
    }, null, { 
        resave: false, 
        saveUninitialized: false, 
        secret: 'np_session_secret', 
        store: sessionStore,
        cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 часа
    });

    app.use(adminJs.options.rootPath, adminRouter);
    await adminJs.initialize();
}

function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        try {
            const [user, created] = await User.findOrCreate({
                where: { id: ctx.from.id },
                defaults: { username: ctx.from.username || 'AGENT' }
            });
            if (created) await GlobalStats.increment('total_users', { where: { id: 1 } });
            ctx.reply(`<b>[ NEURAL PULSE ]</b>\nCore Status: Online\nAgent: ${user.username}`, { 
                parse_mode: 'HTML', 
                ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ OPEN TERMINAL", `${DOMAIN}/static/index.html?v=${Date.now()}`)]])
            });
        } catch (e) { neuralLog(`Bot error: ${e.message}`, 'WARN'); }
    });
}

startNeuralOS();
