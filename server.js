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
pulseEvents.setMaxListeners(20); // Защита от утечек при множестве вкладок админки

// --- 🛠 СИСТЕМА ПОСТРОЧНОГО ЛОГИРОВАНИЯ ---
const neuralLog = (msg, type = 'INFO') => {
    const time = dayjs().format('HH:mm:ss');
    const icons = { INFO: '🔹', WARN: '⚠️', ERROR: '🚨', CORE: '⚡', NET: '🌐', SUCCESS: '✅' };
    console.log(`${icons[type] || '▪️'} [${time}] ${msg}`);
};

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
    neuralLog('BOOTING_NEURAL_OS_INIT...', 'CORE');
    const app = express();
    const bot = new Telegraf(BOT_TOKEN);

    // --- 🛡️ SECURITY & PERFORMANCE ---
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "connect-src": ["'self'", DOMAIN, "https://*.telegram.org", "https://*.tonconnect.org"],
                "img-src": ["'self'", "data:", "https:"],
                "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                "media-src": ["'self'", "data:", "blob:"] 
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: false,
    }));
    
    app.use(compression({ level: 6 }));
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '32kb' }));

    // Статика (index.html всегда в /static)
    app.use('/static', express.static(path.join(__dirname, 'static'), {
        maxAge: '1h',
        etag: true
    }));

    try {
        neuralLog('Database synchronization starting...', 'CORE');
        await initDB();
        neuralLog('Database connection established.', 'SUCCESS');

        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });
        
        setupAPIRoutes(app);
        setupAdminCommands(app, bot);
        setupRealTimeStream(app); 
        
        neuralLog('Initializing AdminJS Panel (Complex Load)...', 'CORE');
        await setupAdminPanel(app);
        
        // Принудительная очистка памяти после тяжелой загрузки AdminJS
        if (global.gc) {
            neuralLog('Post-Init GC Triggered', 'CORE');
            global.gc();
        }

        setupBotHandlers(bot);

        // ✅ WEBHOOK GATEWAY
        app.post(`/telegraf/${BOT_TOKEN}`, async (req, res) => {
            try {
                if (!req.body || Object.keys(req.body).length === 0) return res.sendStatus(200);
                await bot.handleUpdate(req.body, res);
            } catch (err) {
                neuralLog(`Telegraf Gateway Error: ${err.message}`, 'ERROR');
            } finally {
                if (!res.headersSent) res.sendStatus(200);
            }
        });

        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, {
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query']
        });
        neuralLog(`Webhook active: ${DOMAIN}/telegraf/${BOT_TOKEN}`, 'SUCCESS');

        // --- 🩺 SYSTEM PULSE ---
        setInterval(async () => {
            try {
                const startTime = Date.now();
                const mem = process.memoryUsage().rss / 1024 / 1024;
                const load = (os.loadavg()[0]).toFixed(1);

                const [gStats, walletCount, lastUser] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.count({ where: { wallet: { [Op.not]: null } } }),
                    User.findOne({ order: [['created_at', 'DESC']] })
                ]);

                const pulseData = {
                    time: dayjs().format('HH:mm:ss'),
                    mem_usage: Math.round(mem),
                    server_load: parseFloat(load), 
                    user_count: gStats?.total_users || 0,
                    active_wallets: walletCount || 0,
                    total_balance: parseFloat(gStats?.total_balance || 0),
                    db_latency: Date.now() - startTime,
                    recent_event: lastUser ? `AGENT_${lastUser.id}_READY` : 'CORE_IDLE',
                    event_type: 'SYSTEM'
                };

                pulseEvents.emit('update', pulseData);
                await Stats.create(pulseData);
            } catch (e) { neuralLog(`Pulse Error: ${e.message}`, 'WARN'); }
        }, 30000); // 30 сек для экономии ресурсов Bothost

        // --- 🌐 SPA FALLBACK ---
        app.get('*', (req, res, next) => {
            if (req.url.startsWith('/api') || req.url.startsWith('/admin') || req.url.startsWith('/telegraf') || req.url.startsWith('/static')) {
                return next();
            }
            res.sendFile(path.resolve(__dirname, 'static', 'index.html'));
        });

        app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`, 'SUCCESS');
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
                    bot.telegram.sendMessage(user.id, `<b>[ BROADCAST ]</b>\n${message}`, { parse_mode: 'HTML' }).catch(()=>{});
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
    app.post('/api/click', rateLimit({ windowMs: 1000, max: 20 }), async (req, res) => {
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
            { resource: User, options: { navigation: { name: 'CORE' } } },
            { resource: Stats, options: { navigation: { name: 'OS' } } },
            { resource: GlobalStats, options: { navigation: { name: 'CORE' } } }
        ],
        rootPath: '/admin',
        componentLoader,
        bundler: { isProduction: true }, // КРИТИЧНО для Bothost
        dashboard: { 
            component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
            handler: async () => {
                const [gs, history] = await Promise.all([
                    GlobalStats.findByPk(1),
                    Stats.findAll({ limit: 20, order: [['created_at', 'DESC']] })
                ]);
                return { totalUsers: gs?.total_users, totalBalance: gs?.total_balance, history: history.reverse() };
            }
        },
        branding: { companyName: 'NEURAL PULSE', withMadeWithAdminJS: false }
    });

    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate: async (email, password) => (email === '1' && password === '1' ? { email } : null),
        cookiePassword: 'np-titan-secure-v3',
    }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

    app.use(adminJs.options.rootPath, adminRouter);
    await adminJs.initialize();
}

function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        const [user, created] = await User.findOrCreate({
            where: { id: ctx.from.id },
            defaults: { username: ctx.from.username || 'AGENT' }
        });
        if (created) await GlobalStats.increment('total_users', { where: { id: 1 } });
        ctx.reply(`<b>[ NEURAL PULSE ]</b>\nREADY.`, { 
            parse_mode: 'HTML', 
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ", `${DOMAIN}/static/index.html?v=${Date.now()}`)]])
        });
    });
}

startNeuralOS();
