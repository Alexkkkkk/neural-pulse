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

// --- 📡 СОБЫТИЙНАЯ ШИНА РЕАЛЬНОГО ВРЕМЕНИ ---
const pulseEvents = new EventEmitter(); 
pulseEvents.setMaxListeners(50); 

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

    // Статика (index.html, изображения)
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
        
        neuralLog('Core: Initializing Admin Interface...', 'CORE');
        setupAdminPanel(app).then(() => {
            neuralLog('Admin Interface ready (Dark Mode Active).', 'SUCCESS');
        }).catch(e => neuralLog(`Admin Init Error: ${e.message}`, 'WARN'));

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
                    event_type: 'SYSTEM',
                    server_load: parseFloat(load.toFixed(2)), 
                    db_latency: Date.now() - startTime,
                    user_count: gStats?.total_users || 0,
                    active_wallets: walletCount || 0,
                    total_liquidity: parseFloat(gStats?.total_balance || 0),
                    recent_event: 'HEARTBEAT_STABLE',
                    time: dayjs().format('HH:mm:ss')
                };

                pulseEvents.emit('update', pulseData);
                
                await Stats.create({
                    mem_usage: Math.round(mem),
                    server_load: pulseData.server_load,
                    user_count: pulseData.user_count,
                    total_balance: pulseData.total_liquidity,
                    db_latency: pulseData.db_latency
                });
            } catch (e) { neuralLog(`Pulse skip: ${e.message}`, 'WARN'); }
        }, 15000);

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

// --- 🛰️ ADMIN COMMANDS & BROADCAST ---
function setupAdminCommands(app, bot) {
    app.post('/api/admin/command', async (req, res) => {
        try {
            const { action, message } = req.body;
            if (action === 'broadcast' && message) {
                const users = await User.findAll({ attributes: ['id'] });
                let sentCount = 0;
                for (const user of users) {
                    bot.telegram.sendMessage(user.id, `<b>[ SYSTEM_BROADCAST ]</b>\n\n${message}`, { parse_mode: 'HTML' }).catch(()=>{});
                    sentCount++;
                }
                pulseEvents.emit('update', { 
                    recent_event: `BROADCAST_SENT: ${sentCount} AGENTS`,
                    event_type: 'SYSTEM'
                });
                return res.json({ success: true });
            }
            res.sendStatus(200);
        } catch (e) { res.status(500).send(e.message); }
    });
}

// --- 🌊 SSE STREAM SERVER ---
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

// --- ⚡ API ROUTES ---
function setupAPIRoutes(app) {
    app.post('/api/click', rateLimit({ windowMs: 1000, max: 40 }), async (req, res) => {
        const { userId, count } = req.body;
        if (!userId || !count || count > 100) return res.status(403).send();
        try {
            const user = await User.findByPk(userId);
            if (!user) return res.status(404).send();
            const multi = MULTIPLIERS.find(m => user.balance >= m.threshold)?.multi || 1;
            const reward = Math.floor(count * multi);
            await Promise.all([
                user.increment('balance', { by: reward }),
                GlobalStats.increment('total_balance', { by: reward, where: { id: 1 } })
            ]);
            const newBalance = parseFloat(user.balance) + reward;
            pulseEvents.emit('update', {
                event_type: 'USER_UPDATE',
                user_data: { id: user.id, username: user.username, balance: newBalance, status: user.status },
                recent_event: `AGENT_${user.id.toString().slice(-4)}: +${reward} NP`
            });
            res.json({ balance: newBalance });
        } catch (e) { res.status(500).send(); }
    });
}

// --- 🖥️ ADMINJS CONFIG (DARK THEME) ---
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
                const [gs, history, users] = await Promise.all([
                    GlobalStats.findByPk(1),
                    Stats.findAll({ limit: 15, order: [['created_at', 'DESC']] }),
                    User.findAll({ limit: 20, order: [['balance', 'DESC']] })
                ]);
                return { 
                    totalUsers: gs?.total_users, 
                    totalBalance: gs?.total_balance, 
                    history: history.reverse(),
                    usersList: users.map(u => u.toJSON()) 
                };
            }
        },
        branding: { 
            companyName: 'NEURAL PULSE', 
            withMadeWithAdminJS: false,
            // --- ПОЛНАЯ ТЕМНАЯ ТЕМА ---
            theme: {
                colors: {
                    primary100: '#00f2fe',
                    primary80: '#00ddec',
                    primary60: '#00c1ce',
                    bg: '#0a0b10',           // Фон страницы
                    navBg: '#0f111a',        // Сайдбар
                    sidebar: '#0f111a',
                    container: '#161925',    // Карточки
                    border: '#242a3d',
                    inputBorder: '#242a3d',
                    white: '#e2e8f0',        // Текст
                    grey100: '#8e99ab',
                    grey80: '#64748b',
                    grey60: '#475569',
                    grey40: '#1e293b',
                    error: '#ff4d4d',
                    success: '#00f2fe'
                }
            }
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
        cookie: { maxAge: 1000 * 60 * 60 * 24 }
    });

    app.use(adminJs.options.rootPath, adminRouter);
    await adminJs.initialize();
}

// --- 🤖 BOT HANDLERS ---
function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        try {
            const [user, created] = await User.findOrCreate({
                where: { id: ctx.from.id },
                defaults: { username: ctx.from.username || 'AGENT', balance: 0 }
            });
            if (created) {
                await GlobalStats.increment('total_users', { where: { id: 1 } });
                pulseEvents.emit('update', { 
                    recent_event: `NEW_AGENT_CONNECTED: ${user.username}`,
                    event_type: 'SYSTEM'
                });
            }
            ctx.reply(`<b>[ NEURAL PULSE ]</b>\nCore Status: Online\nAgent: ${user.username}\nNetwork: TITAN_NODE_NL`, { 
                parse_mode: 'HTML', 
                ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ OPEN TERMINAL", `${DOMAIN}/static/index.html?v=${Date.now()}`)]])
            });
        } catch (e) { neuralLog(`Bot error: ${e.message}`, 'WARN'); }
    });
}

startNeuralOS();
