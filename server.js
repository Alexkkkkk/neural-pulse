import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import OpenAI from 'openai';

// 1. Импорты из БД и логов
import { sequelize, User, Task, Stats, sessionStore, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: 'YOUR_OPENAI_API_KEY' });

// Глобальная переменная для бота, чтобы роут видел его сразу
let bot;

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE: CORE V5.4 STABLE');
    logger.system('══════════════════════════════════════════════════');

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));

    // --- 1. ПРИОРИТЕТНЫЕ МАРШРУТЫ (МГНОВЕННЫЙ ОТВЕТ) ---
    app.get('/api/health', (req, res) => res.status(200).json({ status: 'online', uptime: process.uptime() }));

    // КРИТИЧЕСКИЙ ПРАВКА: Вебхук ловит запросы СРАЗУ
    app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
        if (bot) {
            bot.handleUpdate(req.body, res).catch(err => {
                logger.error("Telegraf Fail", err);
                if (!res.headersSent) res.sendStatus(200);
            });
        } else {
            // Если бот еще грузится, просто говорим Telegram "Принято", чтобы не было 504
            res.sendStatus(200);
        }
    });

    app.use('/static', express.static(path.join(__dirname, 'static')));

    // --- 2. МГНОВЕННЫЙ ЗАПУСК ПОРТА ---
    app.listen(PORT, '0.0.0.0', () => {
        logger.system(`✅ NETWORK PORT ${PORT} OPEN (FAST START)`);
    });

    try {
        // --- 3. ИНИЦИАЛИЗАЦИЯ БД ---
        await initDB();
        
        // --- 4. TELEGRAM BOT ENGINE ---
        bot = new Telegraf(BOT_TOKEN);

        bot.start(async (ctx) => {
            const userId = ctx.from.id;
            const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
            const webAppUrl = `${DOMAIN}/static/index.html`;
            const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", webAppUrl)]]);

            try {
                let user = await User.findByPk(userId);
                if (!user) {
                    let startBalance = 0;
                    let referredBy = null;
                    if (refId && refId !== userId) {
                        const referrer = await User.findByPk(refId);
                        if (referrer) {
                            referredBy = refId;
                            startBalance = 5000;
                            await referrer.update({ 
                                balance: parseFloat(referrer.balance) + 10000, 
                                referrals: referrer.referrals + 1 
                            });
                            bot.telegram.sendMessage(refId, `✅ <b>Система:</b> Новый агент! +10k NP.`, { parse_mode: 'HTML' }).catch(() => {});
                        }
                    }
                    user = await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: startBalance, referred_by: referredBy });
                }

                const caption = `<b>Neural Pulse</b>\n\nАгент: <code>${user.username}</code>\nБаланс: <b>${user.balance} NP</b>`;
                const logoPath = path.join(__dirname, 'static/images/logo.png');
                if (fs.existsSync(logoPath)) await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
                else await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
            } catch (e) { logger.error(`Bot Start Error`, e); }
        });

        // --- 5. АСИНХРОННЫЙ ADMINJS ---
        const { default: AdminJS, ComponentLoader } = await import('adminjs');
        const { default: AdminJSExpress } = await import('@adminjs/express');
        const AdminJSSequelize = await import('@adminjs/sequelize');

        AdminJS.registerAdapter(AdminJSSequelize);
        const componentLoader = new ComponentLoader();
        const dashboardPath = path.join(__dirname, 'static', 'dashboard.jsx');
        let DASHBOARD_COMPONENT = fs.existsSync(dashboardPath) ? componentLoader.add('Dashboard', dashboardPath) : null;

        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Агенты' } } },
                { resource: Task, options: { navigation: { name: 'Контракты' } } },
                { resource: Stats, options: { navigation: { name: 'Система' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: DASHBOARD_COMPONENT ? { component: DASHBOARD_COMPONENT } : {},
            branding: { companyName: 'Neural Pulse Hub', logo: '/static/images/logo.png', softwareBrothers: false },
            bundler: { minify: true, force: false } 
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-32-chars',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);
        adminJs.initialize().then(() => logger.system("🛠 ADMIN PANEL READY (ASYNC)"));

        // --- 6. УСТАНОВКА ВЕБХУКА ---
        setTimeout(async () => {
            try {
                const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
                await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
                logger.system(`📡 WEBHOOK SECURELY ACTIVE`);
            } catch (e) { logger.error("Webhook Error", e); }
        }, 5000); 

    } catch (err) {
        logger.error("🚨 BOOT ERROR", err);
    }
};

process.on('unhandledRejection', (e) => logger.error('Unhandled Rejection', e));
process.on('uncaughtException', (e) => logger.error('Uncaught Exception', e));

startEngine();
