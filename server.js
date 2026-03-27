import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Ресурсы ядра (БД и логи)
import { sequelize, User, Task, Stats, sessionStore, initDB, logSystemStats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ⚙️ TITAN CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const DASHBOARD_COMPONENT = path.join(__dirname, 'static', 'dashboard.jsx');

// Статические множители (в памяти, для скорости)
const MULTIPLIERS = [
    { threshold: 2000000, multi: 3.5 },
    { threshold: 500000, multi: 2.5 },
    { threshold: 100000, multi: 2.0 },
    { threshold: 10000, multi: 1.5 },
    { threshold: 0, multi: 1.0 }
];

async function startNeuralOS() {
    const app = express();

    // --- 🛡️ ОПТИМИЗАЦИЯ ПОД 1 ЯДРО ---
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(compression({ level: 6 })); // Оптимально для CPU
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '32kb' })); // Чем меньше, тем быстрее парсинг

    // Агрессивное кэширование статики
    app.use('/static', express.static(path.join(__dirname, 'static'), {
        maxAge: '1h',
        etag: true
    }));

    try {
        console.clear();
        logger.system('╔══════════════════════════════════════════════════╗');
        logger.system('║      NEURAL PULSE: SINGLE-CORE TITAN v12.0       ║');
        logger.system('║   OPTIMIZED FOR BOTH HOST | MODE: STABLE-FLOW    ║');
        logger.system('╚══════════════════════════════════════════════════╝');

        await initDB();
        const bot = new Telegraf(BOT_TOKEN);

        // --- 🧬 МОДУЛИ ---
        setupAPIRoutes(app);
        await setupAdminPanel(app);
        setupBotHandlers(bot);

        // ✅ FAIL-SAFE WEBHOOK GATEWAY
        // Используем async/await для корректной обработки на одном ядре
        app.post(`/telegraf/${BOT_TOKEN}`, async (req, res) => {
            try {
                await bot.handleUpdate(req.body, res);
            } catch (err) {
                logger.error("⚡ Gate Error", err);
            } finally {
                if (!res.headersSent) res.sendStatus(200);
            }
        });

        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, {
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query']
        });

        // --- 🩺 SMART CLEANUP (Раз в 2 минуты) ---
        setInterval(() => {
            const memory = process.memoryUsage().rss / 1024 / 1024;
            if (memory > 230) { // Критическая отметка для 1 ядра на хостинге
                logger.system(`♻️ Memory Guard: ${Math.round(memory)}MB usage. Cleaning...`);
                if (global.gc) global.gc();
            }
            logSystemStats();
        }, 120000);

        // --- 🌐 СТАРТ ---
        app.listen(PORT, '0.0.0.0', () => {
            logger.system(`✅ TITAN CORE ONLINE [PORT: ${PORT}]`);
        });

        // Защита от падения процесса
        process.on('uncaughtException', (e) => logger.error('☢️ UNCAUGHT', e));
        process.on('unhandledRejection', (e) => logger.error('☢️ REJECTION', e));

    } catch (err) {
        logger.error(`🚨 BOOT FAILURE`, err);
        process.exit(1);
    }
}

// --- 🛠️ API: ВЫСОКАЯ ПРОПУСКНАЯ СПОСОБНОСТЬ ---
function setupAPIRoutes(app) {
    const clickLimit = rateLimit({
        windowMs: 1000,
        max: 10, // 10 кликов в секунду - предел для честного игрока
        handler: (req, res) => res.status(429).json({ error: "Pulse overload" })
    });

    app.post('/api/click', clickLimit, async (req, res) => {
        const { userId, count } = req.body;
        
        // Валидация "на лету"
        if (!userId || !count || count > 100 || count <= 0) return res.status(403).send();

        try {
            // Используем raw query или простой поиск для экономии ресурсов
            const user = await User.findByPk(userId, { attributes: ['id', 'balance'] });
            if (!user) return res.status(404).send();

            // Быстрый расчет множителя без вызова тяжелых функций
            const currentBalance = parseFloat(user.balance);
            const multi = MULTIPLIERS.find(m => currentBalance >= m.threshold).multi;
            const reward = Math.floor(count * multi);

            // Атомарное обновление (increment — это SQL: SET balance = balance + X)
            await User.increment({ balance: reward }, { where: { id: userId } });

            // Мгновенный ответ
            res.json({ s: 1, balance: currentBalance + reward });
        } catch (e) {
            res.status(500).json({ error: "DB Busy" });
        }
    });

    app.get('/api/user/:id', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id, { 
                attributes: ['id', 'username', 'balance'],
                raw: true 
            });
            res.json(user || { error: 404 });
        } catch (e) { res.status(500).send(); }
    });
}

// --- 🤖 BOT: ИНТЕРФЕЙС СВЯЗИ ---
function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        try {
            const [user] = await User.findOrCreate({
                where: { id: ctx.from.id },
                defaults: { username: ctx.from.username || 'AGENT', balance: 0 }
            });

            // Добавляем кэш-бастер к URL, чтобы WebApp всегда был свежим
            const webAppUrl = `${DOMAIN}/static/index.html?v=${Date.now()}`;
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.webApp("⚡ ТЕРМИНАЛ: ВХОД", webAppUrl)],
                [Markup.button.url("📢 КАНАЛ СВЯЗИ", "https://t.me/neural_pulse")]
            ]);

            const text = `<b>[ NEURAL PULSE OS ]</b>\n\n<b>АГЕНТ:</b> <code>${user.username}</code>\n<b>БАЛАНС:</b> <code>${user.balance.toLocaleString()} NP</code>\n\n<i>Статус: Соединение стабильно.</i>`;
            
            const logo = path.join(__dirname, 'static/images/logo.png');
            if (fs.existsSync(logo)) {
                await ctx.replyWithPhoto({ source: logo }, { caption: text, parse_mode: 'HTML', ...keyboard });
            } else {
                await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
            }
        } catch (e) { logger.error("Bot.start fail", e); }
    });
}

// --- 🖥️ ADMIN: КОМАНДНЫЙ ЦЕНТР ---
async function setupAdminPanel(app) {
    try {
        const { default: AdminJS, ComponentLoader } = await import('adminjs');
        const { default: AdminJSExpress } = await import('@adminjs/express');
        const AdminJSSequelize = await import('@adminjs/sequelize');

        AdminJS.registerAdapter(AdminJSSequelize);
        const componentLoader = new ComponentLoader();
        
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'CORE' }, listProperties: ['id', 'username', 'balance'] } },
                { resource: Task, options: { navigation: { name: 'OS' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: { 
                component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT) 
            },
            branding: { 
                companyName: 'NEURAL PULSE',
                softwareBrothers: false,
                theme: { colors: { primary100: '#00f2ff', bg: '#0b0e14' } }
            },
            bundler: { minify: true } 
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === 'admin' && p === 'neural2026') ? { email: 'admin' } : null,
            cookiePassword: 'np-titan-2026-secure',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_titan_secret', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);
        await adminJs.initialize();
        logger.system("🛠 ADMIN TERMINAL ONLINE");
    } catch (err) { logger.error("AdminJS fail", err); }
}

startNeuralOS();
