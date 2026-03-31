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

// --- 🛠 СИСТЕМА ПОСТРОЧНОГО ЛОГИРОВАНИЯ ---
const neuralLog = (msg, type = 'INFO') => {
    const time = dayjs().format('HH:mm:ss');
    const icons = { INFO: '🔹', WARN: '⚠️', ERROR: '🚨', CORE: '⚡', NET: '🌐' };
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

    neuralLog('Security policies and middleware integrated.', 'INFO');

    // Статика
    app.use('/static', express.static(path.join(__dirname, 'static'), {
        maxAge: '1h',
        etag: true
    }));

    try {
        neuralLog('Database synchronization starting...', 'CORE');
        await initDB();
        neuralLog('Database connection established.', 'SUCCESS');

        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });
        neuralLog('GlobalStats state verified.', 'INFO');

        // Инициализация модулей
        neuralLog('Mounting API routes...', 'NET');
        setupAPIRoutes(app);
        
        neuralLog('Mounting Admin Commands...', 'NET');
        setupAdminCommands(app, bot);
        
        neuralLog('Starting RealTime Telemetry Stream...', 'NET');
        setupRealTimeStream(app); 
        
        neuralLog('Initializing AdminJS Panel (Complex Load)...', 'CORE');
        await setupAdminPanel(app);
        
        neuralLog('Setting up Bot Handlers...', 'NET');
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

        neuralLog('Configuring Webhook...', 'NET');
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, {
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query']
        });
        neuralLog(`Webhook active: ${DOMAIN}/telegraf/${BOT_TOKEN}`, 'INFO');

        // --- 🩺 SYSTEM PULSE (TELEMETRY ENGINE) ---
        setInterval(async () => {
            try {
                const startTime = Date.now();
                const mem = process.memoryUsage().rss / 1024 / 1024;
                const cpuCount = os.cpus()?.length || 1;
                const load = ((os.loadavg()[0] / cpuCount) * 100).toFixed(1);

                const [gStats, walletCount, lastUser] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.count({ 
                        where: { wallet: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } 
                    }),
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
                    recent_event: lastUser ? `AGENT_${lastUser.username}_ACTIVE` : 'CORE_STABLE',
                    event_type: lastUser && dayjs().diff(dayjs(lastUser.created_at), 'second') < 15 ? 'AUTH' : 'SYSTEM'
                };

                pulseEvents.emit('update', pulseData);
                await Stats.create(pulseData);

                // Авто-очистка логов статистики
                const count = await Stats.count();
                if (count > 500) {
                    neuralLog('Cleaning old telemetry history...', 'INFO');
                    const oldest = await Stats.findOne({ order: [['created_at', 'ASC']] });
                    if (oldest) await oldest.destroy();
                }
            } catch (e) {
                neuralLog(`Pulse Loop Error: ${e.message}`, 'ERROR');
            }
        }, 10000);

        // --- 🌐 SPA FALLBACK ---
        app.get('*', (req, res, next) => {
            if (req.url.startsWith('/api') || req.url.startsWith('/admin') || req.url.startsWith('/telegraf') || req.url.startsWith('/static')) {
                return next();
            }
            res.sendFile(path.resolve(__dirname, 'static', 'index.html'));
        });

        app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`, 'CORE');
            neuralLog(`Admin Panel: ${DOMAIN}/admin`, 'INFO');
        });

    } catch (err) {
        neuralLog(`🚨 CRITICAL BOOT FAILURE: ${err.stack}`, 'ERROR');
        process.exit(1);
    }
}

// --- 🛰️ ADMIN COMMANDS HANDLER ---
function setupAdminCommands(app, bot) {
    app.post('/api/admin/command', async (req, res) => {
        const { action, message } = req.body;
        neuralLog(`Admin Command Received: ${action}`, 'CORE');
        try {
            if (action === 'broadcast') {
                const users = await User.findAll({ attributes: ['id'] });
                neuralLog(`Broadcasting to ${users.length} agents...`, 'INFO');
                let successCount = 0;
                for (const user of users) {
                    try {
                        await bot.telegram.sendMessage(user.id, `<b>[ SYSTEM BROADCAST ]</b>\n\n${message}`, { parse_mode: 'HTML' });
                        successCount++;
                        if (successCount % 20 === 0) await new Promise(r => setTimeout(r, 1000));
                    } catch (err) { /* Skip inactive */ }
                }
                neuralLog(`Broadcast complete. Sent: ${successCount}`, 'INFO');
                pulseEvents.emit('update', { recent_event: `BROADCAST_SENT: ${successCount}_AGENTS`, event_type: 'SYSTEM' });
            }
            res.sendStatus(200);
        } catch (e) { 
            neuralLog(`Admin Command Failed: ${e.message}`, 'ERROR');
            res.status(500).send(e.message); 
        }
    });
}

function setupRealTimeStream(app) {
    app.get('/api/admin/stream', (req, res) => {
        neuralLog('New Telemetry Subscriber Connected', 'NET');
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
            neuralLog('Telemetry Subscriber Disconnected', 'NET');
            clearInterval(keepAlive);
            pulseEvents.removeListener('update', sendData);
            res.end();
        });
    });
}

function setupAPIRoutes(app) {
    const clickLimit = rateLimit({
        windowMs: 1000, max: 30,
        handler: (req, res) => {
            neuralLog(`Rate Limit Triggered for IP: ${req.ip}`, 'WARN');
            res.status(429).json({ error: "Pulse overload" });
        }
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
        } catch (e) { 
            neuralLog(`Click API Error: ${e.message}`, 'ERROR');
            res.status(500).send(); 
        }
    });

    app.get('/api/user/:id', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ error: "Agent not found" });
            res.json(user);
        } catch (e) { res.status(500).json({ error: "Core sync error" }); }
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
                    neuralLog('Admin Dashboard data requested', 'INFO');
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
                withMadeWithAdminJS: false,
                theme: {
                    colors: { primary100: '#00f2fe', bg: '#0b0e14', container: '#161b22', sidebar: '#0d1117', border: '#30363d', text: '#ffffff' }
                }
            }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') {
                    neuralLog('Admin Authorization Success', 'CORE');
                    return { email: 'admin@neural.os' };
                }
                neuralLog(`Failed Admin Auth Attempt: ${email}`, 'WARN');
                return null;
            },
            cookiePassword: 'np-titan-2026-secure-v2',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_titan_secret_v2', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);
        await adminJs.initialize();
        neuralLog('AdminJS Panel successfully initialized.', 'SUCCESS');
    } catch (err) { 
        neuralLog(`AdminJS Initialization Fail: ${err.message}`, 'ERROR');
        console.error(err); 
    }
}

function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        try {
            neuralLog(`User Start: ${ctx.from.id} (@${ctx.from.username})`, 'NET');
            const [user, created] = await User.findOrCreate({
                where: { id: ctx.from.id },
                defaults: { username: ctx.from.username || 'AGENT', balance: 0 }
            });
            if (created) {
                const gs = await GlobalStats.findByPk(1);
                if (gs) await gs.increment('total_users');
                neuralLog(`New Agent Registered: ${user.username}`, 'CORE');
                pulseEvents.emit('update', { recent_event: `NEW_AGENT: ${user.username}`, event_type: 'AUTH' });
            }
            const webAppUrl = `${DOMAIN}/static/index.html?v=${Date.now()}`;
            const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ: ВХОД", webAppUrl)]]);
            await ctx.reply(`<b>[ NEURAL PULSE ]</b>\n\n<b>АГЕНТ:</b> <code>${user.username}</code>\n<b>СТАТУС:</b> СИСТЕМА АКТИВНА`, { 
                parse_mode: 'HTML', ...keyboard 
            });
        } catch (e) { neuralLog(`Bot Start Error: ${e.message}`, 'ERROR'); }
    });
}

startNeuralOS();
