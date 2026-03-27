import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import cluster from 'cluster';
import OpenAI from 'openai';
import { DataTypes, Op } from 'sequelize'; 

// 1. Импорты БД и логов
import { sequelize, User, Task, Stats, sessionStore, initDB, logSystemStats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const DASHBOARD_COMPONENT = path.join(__dirname, 'static', 'dashboard.jsx');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-...' });

const calculateLevel = (balance) => {
    const b = parseFloat(balance);
    if (b < 10000) return 1;
    if (b < 100000) return 2;
    if (b < 500000) return 3;
    if (b < 2000000) return 4;
    return 5;
};

// --- CLUSTER MANAGER ---
if (cluster.isPrimary) {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE: CLUSTER MODE ACTIVE (V7.0)');
    logger.system('⏳ СТУПЕНЧАТЫЙ ЗАПУСК С ОПТИМИЗАЦИЕЙ РЕСУРСОВ');
    logger.system('══════════════════════════════════════════════════');

    // Запускаем 2 воркера. Воркер 1 — приоритет на Админку, Воркер 2 — на Бота.
    for (let i = 0; i < 2; i++) {
        setTimeout(() => cluster.fork(), i * 15000); // 15 сек разрыв
    }

    cluster.on('exit', (worker) => {
        logger.error(`🚨 WORKER ${worker.process.pid} DIED. RESTARTING...`);
        setTimeout(() => cluster.fork(), 5000);
    });

    setInterval(() => logSystemStats(), 60000); 

} else {
    startWorkerEngine();
}

async function startWorkerEngine() {
    const workerId = cluster.worker.id;
    const app = express();
    
    // --- ГЛОБАЛЬНЫЕ МИДДЛВАРЫ (Доступны везде) ---
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));
    
    // Глобальная статика (логотипы, стили)
    app.use('/static', express.static(path.join(__dirname, 'static')));

    // ✅ ИСПРАВЛЕНИЕ: Глобальный Health Check (теперь /api/health будет работать всегда)
    app.get('/api/health', (req, res) => {
        res.status(200).json({ 
            status: 'pulse_online', 
            worker: workerId, 
            memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB' 
        });
    });

    try {
        await initDB();
        const bot = new Telegraf(BOT_TOKEN);

        // ✅ ИСПРАВЛЕНИЕ: Webhook эндпоинт на всех воркерах
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
            bot.handleUpdate(req.body, res).catch(() => {
                if (!res.headersSent) res.sendStatus(200);
            });
        });

        // 🛠 Настройка маршрутов в зависимости от воркера
        if (workerId === 1) {
            // Worker 1: Полный фарш (Admin + API)
            logger.system(`🛠 [Worker 1] Initializing Primary Admin Hub...`);
            setupAPIRoutes(app); 
            await setupAdminPanel(app);
            
            // Только первый воркер ставит вебхук
            setTimeout(() => {
                bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, { drop_pending_updates: true })
                    .then(() => logger.system(`📡 WEBHOOK SET BY WORKER 1`))
                    .catch(e => logger.error("Webhook fail", e));
            }, 5000);
        } else {
            // Worker 2: High-Performance API & Bot handlers
            logger.system(`⚡ [Worker 2] Launching Neural Bot Engine...`);
            setupBotHandlers(bot);
            setupAPIRoutes(app);
            // Мы не запускаем AdminJS тут, чтобы сэкономить 150MB RAM
        }

        // Финальный 404 (если запрос не попал ни в один роут)
        app.use((req, res, next) => {
            if (req.path.startsWith('/admin')) {
                // Если мы на воркере без админки, перенаправляем (опционально) или просто поясняем
                return res.status(404).send('Admin Panel is hosted on Worker 1. Try refreshing or check load balancer.');
            }
            res.status(404).json({ error: "Route not found" });
        });

        app.listen(PORT, '0.0.0.0', () => {
            logger.system(`✅ Worker ${workerId} Online [Port: ${PORT}]`);
        });

    } catch (err) {
        logger.error(`🚨 WORKER ${workerId} CRITICAL ERROR`, err);
    }
}

// --- МОДУЛЬ 1: ОБРАБОТКА ТЕЛЕГРАМ ---
function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        const userId = ctx.from.id;
        const webAppUrl = `${DOMAIN}/static/index.html`;
        const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", webAppUrl)]]);

        try {
            let user = await User.findByPk(userId);
            if (!user) {
                user = await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: 0 });
            }
            const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${user.username}</code>\nБаланс: <b>${user.balance.toLocaleString()} NP</b>`;
            const logoPath = path.join(__dirname, 'static/images/logo.png');

            if (fs.existsSync(logoPath)) await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
            else await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
        } catch (e) { logger.error(`Bot Fail`, e); }
    });
}

// --- МОДУЛЬ 2: API ДЛЯ WEBAPP ---
function setupAPIRoutes(app) {
    app.get('/api/user/:id', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ error: 'Not found' });
            res.json(user);
        } catch (e) { res.status(500).send(); }
    });

    app.post('/api/click', async (req, res) => {
        const { userId, count } = req.body;
        try {
            const user = await User.findByPk(userId);
            if (user) {
                const power = 1 + (user.level * 0.5);
                user.balance = parseFloat(user.balance) + (count * power);
                await user.save();
                res.json({ balance: user.balance });
            }
        } catch (e) { res.status(500).send(); }
    });
}

// --- МОДУЛЬ 3: ОПТИМИЗИРОВАННАЯ АДМИН-ПАНЕЛЬ ---
async function setupAdminPanel(app) {
    try {
        const { default: AdminJS, ComponentLoader } = await import('adminjs');
        const { default: AdminJSExpress } = await import('@adminjs/express');
        const AdminJSSequelize = await import('@adminjs/sequelize');

        AdminJS.registerAdapter(AdminJSSequelize);
        const componentLoader = new ComponentLoader();
        const DASHBOARD = componentLoader.add('Dashboard', DASHBOARD_COMPONENT);
        
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Агенты' } } },
                { resource: Task, options: { navigation: { name: 'Контракты' } } },
                { resource: Stats, options: { navigation: { name: 'Система' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: {
                component: DASHBOARD,
                handler: async () => {
                    const totalUsers = await User.count();
                    const latest = (await Stats.findOne({ order: [['createdAt', 'DESC']] })) || {};
                    return { totalUsers, cpu: latest.server_load || 0, currentMem: latest.mem_usage || 0 };
                }
            },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                theme: { colors: { primary100: '#00f2ff' } } 
            },
            // ⚡ ОПТИМИЗАЦИЯ: Отключаем лишние проверки в рантайме
            bundler: { minify: true, force: false } 
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === 'admin' && p === 'neural2026') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-fixed-v7',
        }, null, { 
            resave: false, 
            saveUninitialized: false, 
            secret: 'np_secret', 
            store: sessionStore 
        });

        app.use(adminJs.options.rootPath, adminRouter);
        await adminJs.initialize();
        logger.system("🛠 ADMIN PANEL READY ON WORKER 1");
    } catch (err) { logger.error("AdminJS fail", err); }
}
