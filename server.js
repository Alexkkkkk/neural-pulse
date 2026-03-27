import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import os from 'os';

// Импорты модулей БД и логов
import { sequelize, User, Task, Stats, sessionStore, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE: ULTIMATE MONOLITH ACTIVATED');
    logger.system('══════════════════════════════════════════════════');

    const app = express();
    
    // --- 0. БАЗОВЫЕ НАСТРОЙКИ (МГНОВЕННО) ---
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: true }));

    // --- 1. ПРИОРИТЕТНЫЙ HEALTH-CHECK (До тяжелых импортов AdminJS) ---
    app.get('/api/health', (req, res) => {
        const mem = process.memoryUsage();
        res.send(`
        <html><body style="background:#05070a;color:#00f2fe;font-family:monospace;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
            <div style="border:2px solid #00f2fe;padding:30px;box-shadow: 0 0 20px #00f2fe;">
                <h2 style="margin:0 0 15px 0;">> CORE_STATUS: ONLINE</h2>
                <div style="font-size:14px;">
                    <p>MEMORY: ${(mem.rss / 1024 / 1024).toFixed(1)} MB</p>
                    <p>UPTIME: ${Math.floor(process.uptime())}s</p>
                    <p style="color:#33ff66;">⚡ PORT OPENED: ${PORT}</p>
                </div>
                <script>setTimeout(() => location.reload(), 2000);</script>
            </div>
        </body></html>`);
    });

    // --- 2. СТАТИКА ---
    app.use('/static', express.static(path.join(__dirname, 'static')));

    // --- 3. ОТКРЫТИЕ ПОРТА (САМЫЙ ВАЖНЫЙ ШАГ) ---
    const server = app.listen(PORT, '0.0.0.0', () => {
        logger.system(`✅ ПОРТ ${PORT} ОТКРЫТ. ОЖИДАНИЕ ИНИЦИАЛИЗАЦИИ КОМПОНЕНТОВ...`);
    });

    // Настройки для предотвращения обрыва прокси
    server.keepAliveTimeout = 70000;
    server.headersTimeout = 71000;

    try {
        // --- 4. ИНИЦИАЛИЗАЦИЯ БД (ФОНОВАЯ) ---
        await initDB();
        logger.info("CORE_DB: ПОДКЛЮЧЕНО");

        // --- 5. TELEGRAM BOT ---
        const bot = new Telegraf(BOT_TOKEN);
        
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
            bot.handleUpdate(req.body, res).catch(err => {
                logger.error(`[BOT_ERR] ${err.message}`);
                if (!res.headersSent) res.sendStatus(200);
            });
        });

        bot.start(async (ctx) => {
            const webAppUrl = `${DOMAIN}/static/index.html`;
            const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", webAppUrl)]]);
            const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${ctx.from.username || 'AGENT'}</code>`;
            const logoPath = path.join(__dirname, 'static/images/logo.png');

            try {
                await User.findOrCreate({ 
                    where: { id: BigInt(ctx.from.id) }, 
                    defaults: { username: ctx.from.username || 'AGENT' } 
                });
                if (fs.existsSync(logoPath)) {
                    await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
                } else {
                    await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
                }
            } catch (e) { logger.error(`Bot Error: ${e.message}`); }
        });

        // --- 6. ADMINJS (ДИНАМИЧЕСКИЙ ИМПОРТ) ---
        // Импортируем только здесь, чтобы не тормозить запуск порта
        const { default: AdminJS, ComponentLoader } = await import('adminjs');
        const { default: AdminJSExpress } = await import('@adminjs/express');
        const AdminJSSequelize = await import('@adminjs/sequelize');

        AdminJS.registerAdapter(AdminJSSequelize);
        const componentLoader = new ComponentLoader();
        const DASHBOARD = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Агенты' } } },
                { resource: Task, options: { navigation: { name: 'Миссии' } } },
                { resource: Stats, options: { navigation: { name: 'Система' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: { component: DASHBOARD },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                logo: '/static/images/logo.png',
                softwareBrothers: false,
                theme: { colors: { primary100: '#00f2fe', bg: '#05070a' } }
            },
            bundler: { minify: true, force: false }
        });

        await adminJs.initialize();
        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-32-chars',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);

        // --- 7. ФИНАЛЬНЫЙ WEBHOOK ---
        const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
        await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
        logger.system(`📡 МОНОЛИТ ПОЛНОСТЬЮ ГОТОВ. WEBHOOK: OK`);

    } catch (err) {
        logger.error("КРИТИЧЕСКИЙ СБОЙ В ЦИКЛЕ ЗАГРУЗКИ", err);
    }
};

startEngine();
