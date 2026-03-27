import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import AdminJS, { ComponentLoader } from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

// Импорты модулей БД и логов
import { sequelize, User, Task, Stats, sessionStore, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- КОНФИГУРАЦИЯ ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;

AdminJS.registerAdapter(AdminJSSequelize);

const componentLoader = new ComponentLoader();
const DASHBOARD = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE: ULTIMATE MONOLITH ACTIVATED');
    logger.system('══════════════════════════════════════════════════');

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use('/static', express.static(path.join(__dirname, 'static')));

    // --- 1. МГНОВЕННЫЙ ЗАПУСК ПОРТА (УБИВАЕТ 504 TIMEOUT) ---
    const server = app.listen(PORT, () => {
        logger.system(`✅ СЕРВЕР СЛУШАЕТ ПОРТ ${PORT} (ОЖИДАНИЕ ИНИЦИАЛИЗАЦИИ БД...)`);
    });

    try {
        // --- 2. ИНИЦИАЛИЗАЦИЯ БД (ФОНОВАЯ) ---
        await initDB(); 
        logger.info("CORE_DB: ПОДКЛЮЧЕНО И ОЧИЩЕНО");

        // --- 3. TELEGRAM BOT ---
        const bot = new Telegraf(BOT_TOKEN);

        app.post(`/telegraf/${BOT_TOKEN}`, async (req, res) => {
            try {
                await bot.handleUpdate(req.body, res);
            } catch (err) {
                logger.error(`[BOT_UPDATE_ERR] ${err.message}`);
                if (!res.headersSent) res.sendStatus(200);
            }
        });

        bot.start(async (ctx) => {
            const webAppUrl = `${DOMAIN}/static/index.html`;
            const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", webAppUrl)]]);
            const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${ctx.from.username || 'AGENT'}</code>\nСтатус: <b>ONLINE</b>`;
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

        // --- 4. HUD ДИАГНОСТИКА ---
        app.get('/api/health', async (req, res) => {
            const start = Date.now();
            let dbStatus = 'OFFLINE';
            try { await sequelize.authenticate(); dbStatus = 'STABLE'; } catch(e) { dbStatus = 'CRITICAL'; }
            const mem = process.memoryUsage();
            const load = (os.loadavg()[0] * 10).toFixed(1);

            res.send(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8"><title>NP_CORE_HUD</title>
                <style>
                    body { background: #05070a; color: #00f2fe; font-family: monospace; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                    .hud { border: 2px solid #00f2fe; padding: 25px; width: 400px; box-shadow: 0 0 20px rgba(0, 242, 254, 0.2); }
                    .row { display: flex; justify-content: space-between; margin: 10px 0; }
                    .ok { color: #33ff66; }
                </style>
                <script>setTimeout(() => location.reload(), 5000);</script>
            </head>
            <body>
                <div class="hud">
                    <h2>> SYSTEM_ULTIMATE_MONITOR</h2>
                    <div class="row"><span>DATABASE</span><span class="${dbStatus === 'STABLE' ? 'ok' : ''}">${dbStatus}</span></div>
                    <div class="row"><span>LATENCY</span><span>${Date.now() - start}ms</span></div>
                </div>
            </body></html>`);
        });

        // --- 5. ADMINJS ---
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

        // --- 6. WEBHOOK ACTIVATION ---
        setTimeout(async () => {
            try {
                const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
                await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
                logger.system(`📡 WEBHOOK АКТИВЕН -> ${webhookUrl}`);
            } catch (e) { logger.error(`Webhook Fail: ${e.message}`); }
        }, 5000);

    } catch (err) {
        logger.error("КРИТИЧЕСКИЙ СБОЙ ПРИ ИНИЦИАЛИЗАЦИИ", err);
        // Не выходим из процесса, чтобы сервер продолжал «висеть» на порту для диагностики
    }
};

startEngine();
