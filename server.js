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

// --- 🤖 ПОДДЕРЖКА БОТА ---
function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        const { id, username, first_name } = ctx.from;
        try {
            // Регистрация пользователя
            const [user, created] = await User.findOrCreate({
                where: { id },
                defaults: { 
                    username: username || first_name || 'AGENT',
                    balance: 0 
                }
            });

            if (created) {
                await GlobalStats.increment('total_users', { by: 1, where: { id: 1 } });
            }

            await ctx.replyWithPhoto(
                { url: `${DOMAIN}/static/images/logo.png` }, 
                {
                    caption: `*Welcome to Neural Pulse, ${user.username}* \n\nСистема готова к генерации прибыли. Начни добычу прямо сейчас!`,
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp('🚀 Launch OS', `${DOMAIN}/static/index.html`)]
                    ])
                }
            );
        } catch (e) {
            console.error("Bot Start Error", e);
        }
    });
}

// --- 🌐 API ROUTES ---
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
        } catch (e) {
            res.status(500).json({ error: "Core sync error" });
        }
    });

    app.post('/api/click', clickLimit, async (req, res) => {
        const { userId, count } = req.body;
        if (!userId || !count || count > 100) return res.status(403).send();
        
        try {
            const user = await User.findByPk(userId);
            if (!user) return res.status(404).send();
            
            const config = MULTIPLIERS.find(m => user.balance >= m.threshold) || { multi: 1.0 };
            const reward = Math.floor(count * config.multi);
            
            await Promise.all([
                user.increment('balance', { by: reward }),
                GlobalStats.increment('total_balance', { by: reward, where: { id: 1 } })
            ]);
            
            res.json({ s: 1, balance: user.balance + reward });
        } catch (e) { res.status(500).send(); }
    });
}

// --- 📊 ADMIN PANEL ---
async function setupAdminPanel(app) {
    const { default: AdminJS, ComponentLoader } = await import('adminjs');
    const { default: AdminJSExpress } = await import('@adminjs/express');
    const { default: AdminJSSequelize } = await import('@adminjs/sequelize');

    AdminJS.registerAdapter(AdminJSSequelize);
    const componentLoader = new ComponentLoader();
    
    const adminJs = new AdminJS({
        resources: [
            { resource: User, options: { navigation: { name: 'CORE' }, listProperties: ['id', 'username', 'balance', 'wallet'] } },
            { resource: Task, options: { navigation: { name: 'OS' } } },
            { resource: Stats, options: { navigation: { name: 'OS' } } },
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
                    history: (historyData || []).reverse()
                };
            }
        },
        branding: { 
            companyName: 'NEURAL PULSE',
            logo: '/static/images/logo.png',
            withMadeWithLove: false
        }
    });

    const router = AdminJSExpress.buildRouter(adminJs);
    app.use(adminJs.options.rootPath, router);
}

// Поток данных SSE
function setupRealTimeStream(app) {
    app.get('/api/admin/stream', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const sendData = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        pulseEvents.on('update', sendData);
        req.on('close', () => {
            pulseEvents.removeListener('update', sendData);
            res.end();
        });
    });
}

// --- 🚀 BOOT SYSTEM ---
async function startNeuralOS() {
    const app = express();
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(compression());
    app.use(cors());
    app.use(express.json());
    app.use('/static', express.static(path.join(__dirname, 'static')));

    try {
        await initDB();
        const bot = new Telegraf(BOT_TOKEN);

        setupAPIRoutes(app);
        setupRealTimeStream(app); 
        await setupAdminPanel(app);
        setupBotHandlers(bot);

        // Webhook handler
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => bot.handleUpdate(req.body, res));

        // System Pulse Loop (каждые 30 сек)
        setInterval(async () => {
            try {
                const memory = process.memoryUsage().rss / 1024 / 1024;
                const [gStats, walletCount] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.count({ where: { wallet: { [Op.not]: null } } })
                ]);

                const pulseData = {
                    time: dayjs().format('HH:mm:ss'),
                    mem_usage: Math.round(memory),
                    user_count: gStats?.total_users || 0,
                    active_wallets: walletCount,
                    total_balance: parseFloat(gStats?.total_balance || 0)
                };

                pulseEvents.emit('update', pulseData);
            } catch (e) { console.error("Pulse error", e); }
        }, 30000);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`);
            bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);
        });

    } catch (err) {
        console.error(`🚨 BOOT FAILURE`, err);
        process.exit(1);
    }
}

startNeuralOS();
