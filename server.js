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

// Мультипликаторы дохода
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
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "connect-src": ["'self'", DOMAIN],
                "img-src": ["'self'", "data:", "https:"],
                "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            },
        },
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
        console.log('--- ⚡ NEURAL PULSE SYSTEM BOOTING ---');

        await initDB();
        const bot = new Telegraf(BOT_TOKEN);

        setupAPIRoutes(app);
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

                const [gStats, walletCount] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.count({ 
                        where: { wallet: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } 
                    })
                ]);

                const latency = Date.now() - startTime;
                const pulseData = {
                    time: dayjs().format('HH:mm:ss'),
                    mem_usage: Math.round(mem),
                    server_load: parseFloat(load), 
                    user_count: gStats?.total_users || 0,
                    active_wallets: walletCount || 0,
                    total_balance: parseFloat(gStats?.total_balance || 0),
                    db_latency: latency
                };

                console.log(`[PULSE] ${pulseData.time} | CPU: ${pulseData.server_load}% | RAM: ${pulseData.mem_usage}MB | Users: ${pulseData.user_count}`);

                await Stats.create({
                    user_count: pulseData.user_count,
                    server_load: pulseData.server_load,
                    mem_usage: pulseData.mem_usage,
                    active_wallets: pulseData.active_wallets,
                    total_balance: pulseData.total_balance
                });

                pulseEvents.emit('update', pulseData);

                const count = await Stats.count();
                if (count > 500) {
                    const oldest = await Stats.findOne({ order: [['created_at', 'ASC']] });
                    if (oldest) await oldest.destroy();
                }

            } catch (e) {
                console.error("Pulse Loop Error", e.message);
            }
        }, 10000);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`);
        });

    } catch (err) {
        console.error(`🚨 BOOT FAILURE`, err);
        process.exit(1);
    }
}

function setupRealTimeStream(app) {
    app.get('/api/admin/stream', (req, res) => {
        // Настройки для пробития Nginx-буферизации на Bothost
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // КРИТИЧНО ДЛЯ BOTHOST
        });

        // Сразу отправляем пустой комментарий для открытия потока
        res.write(':\n\n');

        const sendData = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        pulseEvents.on('update', sendData);

        // Пинг-таймер, чтобы соединение не закрывалось по таймауту прокси
        const keepAlive = setInterval(() => {
            res.write(':\n\n');
        }, 15000);
        
        req.on('close', () => {
            clearInterval(keepAlive);
            pulseEvents.removeListener('update', sendData);
            res.end();
        });
    });
}

function setupAPIRoutes(app) {
    const clickLimit = rateLimit({
        windowMs: 1000,
        max: 30,
        handler: (req, res) => res.status(429).json({ error: "Pulse overload" })
    });

    app.get('/api/user/:id', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ error: "Agent not found" });
            res.json(user);
        } catch (e) { res.status(500).json({ error: "Core sync error" }); }
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
                            active_wallets: s.active_wallets
                        })) 
                    };
                }
            },
            branding: { 
                companyName: 'NEURAL PULSE', 
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
        }, null, { resave: false, saveUninitialized: false, secret: 'np_titan_secret_v2', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);
        await adminJs.initialize();

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
            }

            const webAppUrl = `${DOMAIN}/static/index.html?v=${Date.now()}`;
            const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ: ВХОД", webAppUrl)]]);
            
            await ctx.reply(`<b>[ NEURAL PULSE ]</b>\n\n<b>АГЕНТ:</b> <code>${user.username}</code>\n<b>СТАТУС:</b> СИСТЕМА АКТИВНА`, { 
                parse_mode: 'HTML', 
                ...keyboard 
            });
        } catch (e) { console.error("Bot.start fail", e); }
    });
}

startNeuralOS();
