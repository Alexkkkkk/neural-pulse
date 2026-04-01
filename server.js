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
import { sequelize, User, Stats, GlobalStats, sessionStore, initDB, Op } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pulseEvents = new EventEmitter(); 
pulseEvents.setMaxListeners(100); 

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

async function startNeuralOS() {
    neuralLog('BOOTING_NEURAL_OS_INIT...', 'CORE');
    const app = express();
    const bot = new Telegraf(BOT_TOKEN);

    app.use(helmet({
        contentSecurityPolicy: false, // Для корректной работы AdminJS и внешних шрифтов
    }));
    app.use(compression());
    app.use(cors({ origin: '*' }));
    app.use(express.json());

    app.use('/static', express.static(path.join(__dirname, 'static')));

    try {
        await initDB();
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });
        
        setupAPIRoutes(app);
        setupRealTimeStream(app); 
        await setupAdminPanel(app);
        setupBotHandlers(bot);

        // Webhook
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => bot.handleUpdate(req.body, res));
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);
        neuralLog(`✅ TITAN CORE ACTIVE [PORT: ${PORT}]`, 'SUCCESS');

        // --- 🩺 SYSTEM PULSE ---
        setInterval(async () => {
            try {
                const [gStats, walletCount] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.count({ where: { wallet: { [Op.not]: null } } })
                ]);

                const pulseData = {
                    event_type: 'SYSTEM',
                    core_load: (os.loadavg()[0] * 10) + 15 + (Math.random() * 5),
                    sync_memory: (process.memoryUsage().rss / 1024 / 1024) / 4 + 30, 
                    active_agents: gStats?.total_users || 0,
                    ton_reserve: walletCount || 0,
                    network_latency: Math.floor(Math.random() * 20 + 20),
                    pulse_liquidity: parseFloat(gStats?.total_balance || 0),
                    time: dayjs().format('HH:mm:ss')
                };

                pulseEvents.emit('update', pulseData);

                await Stats.create({
                    mem_usage: Math.round(pulseData.sync_memory),
                    server_load: pulseData.core_load,
                    user_count: pulseData.active_agents,
                    total_balance: pulseData.pulse_liquidity,
                    db_latency: pulseData.network_latency
                }).catch(() => {});
            } catch (e) { neuralLog(`Pulse error: ${e.message}`, 'WARN'); }
        }, 10000); // Синхронизация каждые 10 секунд

        app.listen(PORT, '0.0.0.0');

    } catch (err) {
        neuralLog(`🚨 CRITICAL FAILURE: ${err.message}`, 'ERROR');
    }
}

function setupRealTimeStream(app) {
    app.get('/api/admin/stream', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        pulseEvents.on('update', send);
        req.on('close', () => pulseEvents.removeListener('update', send));
    });
}

function setupAPIRoutes(app) {
    app.post('/api/click', async (req, res) => {
        const { userId, count } = req.body;
        try {
            const user = await User.findByPk(userId);
            if (!user) return res.sendStatus(404);
            const reward = count * 1.5;
            await user.increment('balance', { by: reward });
            await GlobalStats.increment('total_balance', { by: reward, where: { id: 1 } });
            res.json({ balance: user.balance + reward });
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
            { resource: User },
            { resource: Stats },
            { resource: GlobalStats }
        ],
        rootPath: '/admin',
        componentLoader,
        dashboard: { 
            component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
            handler: async () => {
                const [gs, users] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.findAll({ limit: 10, order: [['balance', 'DESC']] })
                ]);
                return { totalUsers: gs?.total_users, totalBalance: gs?.total_balance, usersList: users };
            }
        },
        branding: { companyName: 'NEURAL PULSE', theme: { colors: { primary100: '#00f2fe', bg: '#000' } } }
    });

    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate: async (email, password) => (email === '1' && password === '1' ? { email } : null),
        cookiePassword: 'np-titan-crypt-v5',
    }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

    app.use(adminJs.options.rootPath, adminRouter);
    await adminJs.initialize();
}

function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        const [user, created] = await User.findOrCreate({
            where: { id: ctx.from.id },
            defaults: { username: ctx.from.username || 'AGENT', balance: 0 }
        });
        if (created) await GlobalStats.increment('total_users', { where: { id: 1 } });
        ctx.reply(`<b>[ NEURAL PULSE ]</b>\nAgent: ${user.username}`, { 
            parse_mode: 'HTML', 
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ TERMINAL", `${DOMAIN}/static/index.html`)]])
        });
    });
}

startNeuralOS();
