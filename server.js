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

async function startNeuralOS() {
    const app = express();
    const bot = new Telegraf(BOT_TOKEN);

    // --- 🛡️ SECURITY & PERFORMANCE (Оптимизировано для Bothost) ---
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "connect-src": ["'self'", DOMAIN, "https://*.telegram.org", "https://*.tonconnect.org", "wss://*.bridge.tonapi.io"],
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

    // --- 📂 STATIC ASSETS ---
    // 1. Явный проброс манифеста В ПЕРВУЮ ОЧЕРЕДЬ
    app.get('/tonconnect-manifest.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.sendFile(path.join(__dirname, 'static', 'tonconnect-manifest.json'));
    });

    // 2. Общая статика
    app.use('/static', express.static(path.join(__dirname, 'static'), {
        maxAge: '1h',
        etag: true
    }));

    try {
        console.log('--- ⚡ NEURAL PULSE SYSTEM BOOTING ---');

        await initDB();
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });

        setupAPIRoutes(app);
        setupAdminCommands(app, bot);
        setupRealTimeStream(app); 
        await setupAdminPanel(app);
        setupBotHandlers(bot);

        // ✅ WEBHOOK GATEWAY
        app.post(`/telegraf/${BOT_TOKEN}`, async (req, res) => {
            try {
                if (!req.body || Object.keys(req.body).length === 0) return res.sendStatus(200);
                await bot.handleUpdate(req.body, res);
            } catch (err) {
                console.error("⚡ Gate Error", err);
            } finally {
                if (!res.headersSent) res.sendStatus(200);
            }
        });

        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, {
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query']
        });

        // --- 🩺 SYSTEM PULSE ---
        setInterval(async () => {
            try {
                const startTime = Date.now();
                const mem = process.memoryUsage().rss / 1024 / 1024;
                const cpuCount = os.cpus()?.length || 1;
                const load = ((os.loadavg()[0] / cpuCount) * 100).toFixed(1);

                const [gStats, walletCount, lastUser] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.count({ where: { wallet: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } }),
                    User.findOne({ order: [['created_at', 'DESC']] })
                ]);

                const latency = Date.now() - startTime;
                
                const pulseData = {
                    time: dayjs().format('HH:mm:ss'),
                    mem_usage: Math.round(mem),
                    server_load: parseFloat(load), 
                    user_count: gStats?.total_users || 0,
                    active_wallets: walletCount || 0,
                    total_balance: parseFloat(gStats?.total_balance || 0),
                    db_latency: latency,
                    recent_event: lastUser ? `NEW_AGENT: ${lastUser.username}` : 'CORE_STABLE',
                    event_type: lastUser && dayjs().diff(dayjs(lastUser.created_at), 'second') < 15 ? 'AUTH' : 'SYSTEM'
                };

                pulseEvents.emit('update', pulseData);
                await Stats.create(pulseData);

                const count = await Stats.count();
                if (count > 500) {
                    const oldest = await Stats.findOne({ order: [['created_at', 'ASC']] });
                    if (oldest) await oldest.destroy();
                }
            } catch (e) {
                console.error("Pulse Loop Error", e.message);
            }
        }, 15000); // Увеличил интервал до 15с для экономии ресурсов

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`);
        });

    } catch (err) {
        console.error(`🚨 BOOT FAILURE`, err);
        process.exit(1);
    }
}

// ... (setupAdminCommands, setupRealTimeStream, setupAPIRoutes остаются без изменений) ...

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
                    const [gStats, historyData, dailyUsers] = await Promise.all([
                        GlobalStats.findByPk(1),
                        Stats.findAll({ limit: 30, order: [['created_at', 'DESC']] }),
                        User.count({ where: { created_at: { [Op.gte]: dayjs().subtract(24, 'hour').toDate() } } })
                    ]);

                    return { 
                        totalUsers: gStats?.total_users || 0, 
                        total_balance: parseFloat(gStats?.total_balance || 0),
                        dailyUsers: dailyUsers || 0,
                        history: (historyData || []).reverse().map(s => ({ 
                            time: dayjs(s.created_at).format('HH:mm'), 
                            user_count: s.user_count, 
                            server_load: s.server_load, 
                            mem_usage: s.mem_usage,
                            active_wallets: s.active_wallets,
                            db_latency: s.db_latency
                        })) 
                    };
                }
            },
            branding: { 
                companyName: 'NEURAL PULSE OS', 
                logo: '/static/images/logo.png',
                withMadeWithAdminJS: false
            }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') return { email: 'admin@neural.os' };
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
        
        // На Bothost лучше инициализировать после подключения роутера
        await adminJs.initialize(); 

    } catch (err) { console.error("AdminJS fail", err); }
}

// ... (setupBotHandlers остается без изменений) ...

startNeuralOS();
