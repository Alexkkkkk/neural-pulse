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

// --- 🛰️ ПОДСИСТЕМЫ API ---

function setupAPIRoutes(app) {
    const clickLimit = rateLimit({
        windowMs: 1000,
        max: 40,
        handler: (req, res) => res.status(429).json({ error: "Pulse overload" })
    });

    app.post('/api/click', clickLimit, async (req, res) => {
        const { userId, count } = req.body;
        if (!userId || !count || count > 100 || count <= 0) return res.status(403).send();
        try {
            const user = await User.findByPk(userId);
            if (!user) return res.status(404).send();
            
            const currentBalance = parseFloat(user.balance) || 0;
            const config = MULTIPLIERS.find(m => currentBalance >= m.threshold) || { multi: 1.0 };
            const reward = Math.floor(count * config.multi);

            await Promise.all([
                user.increment('balance', { by: reward }),
                GlobalStats.increment('total_balance', { by: reward, where: { id: 1 } })
            ]);

            res.json({ s: 1, balance: currentBalance + reward });
        } catch (e) { res.status(500).send(); }
    });

    app.get('/api/user/:id', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ error: "Agent not found" });
            res.json(user);
        } catch (e) { res.status(500).json({ error: "Core sync error" }); }
    });
}

function setupAdminCommands(app, bot) {
    app.post('/api/admin/command', async (req, res) => {
        const { action, message } = req.body;
        try {
            if (action === 'broadcast') {
                const users = await User.findAll({ attributes: ['id'] });
                let successCount = 0;
                (async () => {
                    for (const user of users) {
                        try {
                            await bot.telegram.sendMessage(user.id, `<b>[ SYSTEM BROADCAST ]</b>\n\n${message}`, { parse_mode: 'HTML' });
                            successCount++;
                            if (successCount % 25 === 0) await new Promise(r => setTimeout(r, 1000));
                        } catch (err) {}
                    }
                    pulseEvents.emit('update', { recent_event: `BROADCAST_COMPLETE: ${successCount}_AGENTS`, event_type: 'SYSTEM' });
                })();
            }
            res.sendStatus(200);
        } catch (e) { res.status(500).send(e.message); }
    });
}

function setupRealTimeStream(app) {
    app.get('/api/admin/stream', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });
        res.write(':\n\n');
        const sendData = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        pulseEvents.on('update', sendData);
        const keepAlive = setInterval(() => res.write(':\n\n'), 15000);
        req.on('close', () => {
            clearInterval(keepAlive);
            pulseEvents.off('update', sendData);
            res.end();
        });
    });
}

async function setupAdminPanel(app) {
    try {
        const { default: AdminJS, ComponentLoader } = await import('adminjs');
        const { default: AdminJSExpress } = await import('@adminjs/express');
        const { default: AdminJSSequelize } = await import('@adminjs/sequelize');

        AdminJS.registerAdapter(AdminJSSequelize);
        const componentLoader = new ComponentLoader();
        
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'CORE' }, listProperties: ['id', 'username', 'balance', 'wallet', 'created_at'] } },
                { resource: Task, options: { navigation: { name: 'OS' } } },
                { resource: Stats, options: { navigation: { name: 'OS' }, listProperties: ['created_at', 'user_count', 'server_load', 'mem_usage'] } },
                { resource: GlobalStats, options: { navigation: { name: 'CORE' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: { 
                component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
                handler: async () => {
                    const [gStats, historyData, dailyUsers, allUsers] = await Promise.all([
                        GlobalStats.findByPk(1),
                        Stats.findAll({ limit: 30, order: [['created_at', 'DESC']] }),
                        User.count({ where: { created_at: { [Op.gte]: dayjs().subtract(24, 'hour').toDate() } } }),
                        User.findAll({ limit: 50, order: [['balance', 'DESC']] })
                    ]);

                    const h = (historyData || []).reverse();

                    return { 
                        totalUsers: gStats?.total_users || 0, 
                        total_balance: parseFloat(gStats?.total_balance || 0),
                        dailyUsers: dailyUsers || 0,
                        usersList: allUsers.map(u => u.toJSON()), 
                        currentLoad: h.length > 0 ? h[h.length-1].server_load : 0,
                        currentLat: h.length > 0 ? h[h.length-1].db_latency : 0,
                        ramUsage: h.length > 0 ? h[h.length-1].mem_usage : 0,
                        history: {
                            load: h.map(s => s.server_load),
                            lat: h.map(s => s.db_latency),
                            tappers: h.map(s => s.user_count),
                            inflow: h.map(s => s.active_wallets)
                        }
                    };
                }
            },
            branding: { 
                companyName: 'NEURAL PULSE OS', 
                logo: '/static/images/logo.png', 
                withMadeWithAdminJS: false,
                theme: {
                    colors: { primary100: '#00f2fe', bg: '#0b0e14', container: '#161b22', sidebar: '#0d1117', border: '#30363d', text: '#ffffff' }
                }
            }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') return { email: 'admin@neural.os' };
                return null;
            },
            cookiePassword: 'np-titan-2026-secure-v2',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_titan_secret_v2', store: sessionStore });

        await adminJs.initialize();
        app.use(adminJs.options.rootPath, adminRouter);
        console.log('✅ ADMIN INTERFACE READY');
    } catch (err) { console.error("AdminJS fail", err); }
}

function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        try {
            const [user, created] = await User.findOrCreate({
                where: { id: ctx.from.id },
                defaults: { username: ctx.from.username || 'AGENT', balance: 0 }
            });
            if (created) {
                const gs = await GlobalStats.findByPk(1);
                if (gs) await gs.increment('total_users');
                pulseEvents.emit('update', { recent_event: `NEW_AGENT: ${user.username}`, event_type: 'AUTH' });
            }
            const webAppUrl = `${DOMAIN}/static/index.html?v=${Date.now()}`;
            const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ: ВХОД", webAppUrl)]]);
            await ctx.reply(`<b>[ NEURAL PULSE ]</b>\n\n<b>АГЕНТ:</b> <code>${user.username}</code>\n<b>СТАТУС:</b> СИСТЕМА АКТИВНА`, { parse_mode: 'HTML', ...keyboard });
        } catch (e) { console.error("Bot.start fail", e); }
    });
}

// --- ⚡ ГЛАВНОЕ ЯДРО (BOOT ENGINE) ---

async function startNeuralOS() {
    const app = express();
    const bot = new Telegraf(BOT_TOKEN);

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "connect-src": ["'self'", DOMAIN, "https://*.telegram.org", "https://*.tonconnect.org", "wss://*.bridge.tonapi.io", "https://*.tonapi.io"],
                "img-src": ["'self'", "data:", "https:"],
                "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
                "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                "font-src": ["'self'", "https://fonts.gstatic.com"],
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

    app.get('/tonconnect-manifest.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.sendFile(path.join(__dirname, 'static', 'tonconnect-manifest.json'));
    });

    app.use('/static', express.static(path.join(__dirname, 'static'), { 
        maxAge: '1h',
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        }
    }));

    try {
        console.log('--- ⚡ NEURAL PULSE SYSTEM BOOTING ---');
        
        await initDB();
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });

        await setupAdminPanel(app);
        setupAPIRoutes(app);
        setupAdminCommands(app, bot);
        setupRealTimeStream(app); 
        setupBotHandlers(bot);

        app.post(`/telegraf/${BOT_TOKEN}`, async (req, res) => {
            try {
                if (req.body && Object.keys(req.body).length > 0) {
                    await bot.handleUpdate(req.body, res);
                }
            } catch (err) { console.error("Gate Error", err); }
            finally { if (!res.headersSent) res.sendStatus(200); }
        });

        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, { drop_pending_updates: true });

        setInterval(async () => {
            try {
                const start = Date.now();
                const mem = process.memoryUsage().rss / 1024 / 1024;
                const cpuCount = os.cpus()?.length || 1;
                const load = ((os.loadavg()[0] / cpuCount) * 100).toFixed(1);

                const [gStats, walletCount] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.count({ where: { wallet: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } })
                ]);

                const pulseData = {
                    time: dayjs().format('HH:mm:ss'),
                    mem_usage: Math.round(mem),
                    server_load: parseFloat(load),
                    user_count: gStats?.total_users || 0,
                    active_wallets: walletCount || 0,
                    total_balance: parseFloat(gStats?.total_balance || 0),
                    db_latency: Date.now() - start,
                    event_type: 'SYSTEM'
                };

                pulseEvents.emit('update', pulseData);
                await Stats.create(pulseData);
                
                const count = await Stats.count();
                if (count > 500) {
                    const oldest = await Stats.findOne({ order: [['created_at', 'ASC']] });
                    if (oldest) await oldest.destroy();
                }
            } catch (e) { console.error("Pulse Loop Error", e.message); }
        }, 15000);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`);
        });

    } catch (err) {
        console.error(`🚨 BOOT FAILURE`, err);
        process.exit(1);
    }
}

startNeuralOS();
