import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
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
const BOT_TOKEN = process.env.BOT_TOKEN || "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const DASHBOARD_COMPONENT = path.join(__dirname, 'static', 'dashboard.jsx');

async function startNeuralOS() {
    neuralLog('BOOTING_NEURAL_OS_INIT...', 'CORE');
    const app = express();
    const bot = new Telegraf(BOT_TOKEN);

    // Middleware
    app.use(helmet({
        contentSecurityPolicy: false, // Нужно для AdminJS и внешних ресурсов
    }));
    app.use(compression());
    app.use(cors({ origin: '*' }));
    app.use(express.json());

    // Раздача статики (index.html, images, etc)
    app.use('/static', express.static(path.join(__dirname, 'static')));

    try {
        await initDB();
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });
        
        setupAPIRoutes(app);
        setupRealTimeStream(app); 
        await setupAdminPanel(app);
        setupBotHandlers(bot);

        // Webhook для Telegram
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => bot.handleUpdate(req.body, res));
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);
        
        neuralLog(`✅ TITAN CORE ACTIVE [PORT: ${PORT}]`, 'SUCCESS');

        // --- 🩺 SYSTEM PULSE (Каждые 10 секунд) ---
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
        }, 10000);

        app.listen(PORT, '0.0.0.0');

    } catch (err) {
        neuralLog(`🚨 CRITICAL FAILURE: ${err.message}`, 'ERROR');
    }
}

// Поток данных для админ-панели (Server-Sent Events)
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

// API для взаимодействия с фронтендом (Mini App)
function setupAPIRoutes(app) {
    // Получение данных пользователя при входе
    app.get('/api/user/:userId', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.userId);
            if (!user) return res.status(404).json({ error: "User not found" });
            res.json(user);
        } catch (e) { res.status(500).send(e.message); }
    });

    // Сохранение прогресса (Balance, Levels, Wallet)
    app.post('/api/save', async (req, res) => {
        const { id, balance, tap_lvl, mine_lvl, energy_lvl, wallet } = req.body;
        try {
            const user = await User.findByPk(id);
            if (!user) return res.sendStatus(404);

            const oldBalance = parseFloat(user.balance || 0);
            const newBalance = parseFloat(balance);
            const diff = newBalance - oldBalance;

            await user.update({ balance, tap_lvl, mine_lvl, energy_lvl, wallet });
            
            if (diff > 0) {
                await GlobalStats.increment('total_balance', { by: diff, where: { id: 1 } });
            }
            res.sendStatus(200);
        } catch (e) { res.status(500).send(e.message); }
    });

    // AI Советник (для красоты на фронтенде)
    app.post('/api/ai-advice', (req, res) => {
        const { balance } = req.body;
        const advice = balance < 5000 
            ? "> [SYSTEM]: Рекомендую апгрейд Neural Link для ускорения майнинга." 
            : "> [SYSTEM]: Баланс в норме. Время подключать TON кошелек.";
        res.json({ text: advice });
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
            { resource: User, options: { navigation: { name: 'CORE', icon: 'User' } } },
            { resource: Stats, options: { navigation: { name: 'SYSTEM' } } },
            { resource: GlobalStats, options: { navigation: { name: 'SYSTEM' } } }
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
        branding: { 
            companyName: 'NEURAL PULSE', 
            theme: { colors: { primary100: '#00f2fe', bg: '#0b0e11' } },
            logo: `${DOMAIN}/static/images/logo.png`
        }
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

        const welcomeMsg = `<b>[ NEURAL PULSE ]</b>\n\n` +
                           `Добро пожаловать в систему, <code>${user.username}</code>.\n` +
                           `Ваш терминал готов к синхронизации.`;

        ctx.reply(welcomeMsg, { 
            parse_mode: 'HTML', 
            ...Markup.inlineKeyboard([
                [Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", `${DOMAIN}/static/index.html`)],
                [Markup.button.url("🌐 СООБЩЕСТВО", "https://t.me/your_channel")]
            ])
        });
    });
}

startNeuralOS();
