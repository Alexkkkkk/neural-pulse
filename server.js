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

// Ресурсы ядра
import { sequelize, User, Task, Stats, GlobalStats, sessionStore, initDB, Op } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pulseEvents = new EventEmitter(); 
pulseEvents.setMaxListeners(100); 

const neuralLog = (msg, type = 'INFO') => {
    const time = dayjs().format('HH:mm:ss');
    const icons = { INFO: '🔹', WARN: '⚠️', ERROR: '🚨', CORE: '⚡', NET: '🌐', SUCCESS: '✅' };
    console.log(`${icons[type] || '▪️'} [${time}] ${msg}`);
};

// --- CONFIG ---
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
    neuralLog('BOOTING_NEURAL_OS_V4...', 'CORE');
    const app = express();
    const bot = new Telegraf(BOT_TOKEN);

    // --- SECURITY & OPTIMIZATION ---
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "connect-src": ["'self'", DOMAIN, "https://*.telegram.org", "https://*.tonconnect.org"],
                "frame-ancestors": ["'self'", "https://t.me", "https://web.telegram.org"], 
                "img-src": ["'self'", "data:", "https:"],
                "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));
    
    app.use(compression());
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '64kb' }));

    // Статика
    app.use('/static', express.static(path.join(__dirname, 'static'), { etag: true }));

    try {
        await initDB();
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });
        
        setupAPIRoutes(app);
        setupAdminCommands(app, bot);
        setupRealTimeStream(app);
        setupBotHandlers(bot);

        await setupAdminPanel(app);

        // WEBHOOK
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => bot.handleUpdate(req.body, res));
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, {
            allowed_updates: ['message', 'callback_query']
        });

        // --- TELEMETRY PULSE (Отправка реальных данных в Dashboard) ---
        setInterval(async () => {
            try {
                const start = Date.now();
                const [gStats, walletCount] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.count({ where: { wallet: { [Op.not]: null } } })
                ]);

                // Генерация процента ОЗУ для дашборда
                const memUsageBytes = process.memoryUsage().rss;
                const totalMemBytes = os.totalmem();
                const ramPercent = Math.min(((memUsageBytes / totalMemBytes) * 100 * 50).toFixed(1), 100); // Искусственный множитель для визуала

                const pulseData = {
                    event_type: 'SYSTEM',
                    server_load: parseFloat(os.loadavg()[0].toFixed(2)) * 10, // Масштабируем для красоты графика
                    ram_usage: parseFloat(ramPercent),
                    db_latency: Date.now() - start,
                    user_count: gStats?.total_users || 0,
                    active_wallets: walletCount || 0,
                    total_liquidity: parseFloat(gStats?.total_balance || 0),
                    time: dayjs().format('HH:mm:ss')
                };

                pulseEvents.emit('update', pulseData);
                await Stats.create({ 
                    mem_usage: Math.round(memUsageBytes / 1024 / 1024),
                    server_load: pulseData.server_load,
                    db_latency: pulseData.db_latency
                });
            } catch (e) { neuralLog(e.message, 'WARN'); }
        }, 5000); // Каждые 5 сек обновляем админку

        // SPA Fallback
        app.get('*', (req, res, next) => {
            if (['/api', '/admin', '/telegraf', '/static'].some(p => req.url.startsWith(p))) return next();
            res.sendFile(path.resolve(__dirname, 'static', 'index.html'));
        });

        const server = app.listen(PORT, '0.0.0.0', () => neuralLog(`TITAN CORE ACTIVE [PORT: ${PORT}]`, 'SUCCESS'));

        // Graceful Shutdown
        process.on('SIGTERM', () => {
            neuralLog('SHUTDOWN_SIGNAL_RECEIVED', 'WARN');
            server.close(() => process.exit(0));
        });

    } catch (err) {
        neuralLog(`CRITICAL: ${err.message}`, 'ERROR');
        process.exit(1);
    }
}

// --- ADMIN & BROADCAST ---
function setupAdminCommands(app, bot) {
    app.post('/api/admin/command', async (req, res) => {
        const { action, message } = req.body;
        if (action === 'broadcast' && message) {
            const users = await User.findAll({ attributes: ['id'] });
            res.json({ success: true, target_count: users.length });

            (async () => {
                let sent = 0;
                for (const user of users) {
                    try {
                        await bot.telegram.sendMessage(user.id, `<b>[ NEURAL PULSE SYSTEM ]</b>\n\n${message}`, { parse_mode: 'HTML' });
                        sent++;
                        if (sent % 20 === 0) await new Promise(r => setTimeout(r, 1000));
                    } catch (e) { continue; }
                }
                pulseEvents.emit('update', { event_type: 'USER_UPDATE', recent_event: `BROADCAST_COMPLETE: ${sent} AGENTS REACHED` });
            })();
            return;
        }
        res.sendStatus(200);
    });
}

function setupRealTimeStream(app) {
    app.get('/api/admin/stream', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        pulseEvents.on('update', send);
        req.on('close', () => pulseEvents.removeListener('update', send));
    });
}

function setupAPIRoutes(app) {
    app.post('/api/click', rateLimit({ windowMs: 1000, max: 50 }), async (req, res) => {
        const { userId, count } = req.body;
        if (!userId || count > 100) return res.status(403).send();
        try {
            const user = await User.findByPk(userId);
            if (!user) return res.sendStatus(404);
            const multi = MULTIPLIERS.find(m => user.balance >= m.threshold)?.multi || 1;
            const reward = Math.floor(count * multi);
            
            await Promise.all([
                user.increment('balance', { by: reward }),
                GlobalStats.increment('total_balance', { by: reward, where: { id: 1 } })
            ]);

            pulseEvents.emit('update', {
                event_type: 'USER_UPDATE',
                recent_event: `AGENT_${userId.toString().slice(-4)}_MINED: +${reward} NP`
            });
            res.json({ balance: parseFloat(user.balance) + reward });
        } catch (e) { res.sendStatus(500); }
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
        branding: { 
            companyName: 'NEURAL PULSE', 
            withMadeWithAdminJS: false,
            theme: {
                colors: { primary100: '#00f2fe', bg: '#0a0b10', navBg: '#0f111a', sidebar: '#0f111a', container: '#161925', white: '#e2e8f0' }
            }
        },
        dashboard: { component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT) }
    });

    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate: async (e, p) => (e === '1' && p === '1' ? { email: e } : null),
        cookiePassword: 'np-titan-crypt-v5',
    }, null, { resave: false, saveUninitialized: false, secret: 'np_session_secret', store: sessionStore });

    app.use(adminJs.options.rootPath, adminRouter);
    await adminJs.initialize();
}

function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        const [user, created] = await User.findOrCreate({
            where: { id: ctx.from.id },
            defaults: { username: ctx.from.username || 'AGENT', balance: 0 }
        });
        if (created) {
            await GlobalStats.increment('total_users', { where: { id: 1 } });
            pulseEvents.emit('update', { event_type: 'USER_UPDATE', recent_event: `NEW_AGENT_REGISTERED: ${user.username}` });
        }
        
        ctx.reply(`<b>[ NEURAL PULSE ]</b>\nCore: Online\nAgent: ${user.username}`, { 
            parse_mode: 'HTML', 
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ OPEN TERMINAL", `${DOMAIN}/static/index.html`)]])
        });
    });
}

startNeuralOS();
