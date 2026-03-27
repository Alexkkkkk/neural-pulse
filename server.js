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

// Инициализация ИИ
const openai = new OpenAI({ apiKey: 'YOUR_OPENAI_API_KEY' });

// Уровни системы
const calculateLevel = (balance) => {
    const b = parseFloat(balance);
    if (b < 10000) return 1;
    if (b < 100000) return 2;
    if (b < 500000) return 3;
    if (b < 2000000) return 4;
    return 5;
};

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE: CORE V5.2 DEPLOYED');
    logger.system('══════════════════════════════════════════════════');

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));

    // --- 1. HEALTH-CHECK (Оживляет мониторинг хостинга) ---
    app.get('/api/health', (req, res) => {
        res.status(200).json({ status: 'online', uptime: process.uptime(), memory: process.memoryUsage().rss });
    });

    app.use('/static', express.static(path.join(__dirname, 'static')));

    // --- 2. СТАРТ HTTP СЕРВЕРА ---
    const server = app.listen(PORT, '0.0.0.0', () => {
        logger.system(`✅ PORT ${PORT} OPEN. BOOTING DATABASE...`);
    });

    try {
        // --- 3. ИНИЦИАЛИЗАЦИЯ БД ---
        await initDB();
        
        // --- 4. TELEGRAM BOT ENGINE ---
        const bot = new Telegraf(BOT_TOKEN);

        // Обработка вебхука
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
            bot.handleUpdate(req.body, res).catch(err => {
                logger.error("Telegraf Middleware Fail", err);
                if (!res.headersSent) res.sendStatus(200);
            });
        });

        // Логика команды /start
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
                            bot.telegram.sendMessage(refId, `✅ <b>Система:</b> Новый агент в сети! +10k NP.`, { parse_mode: 'HTML' }).catch(() => {});
                        }
                    }
                    user = await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: startBalance, referred_by: referredBy });
                }

                const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${user.username}</code>\nБаланс: <b>${user.balance} NP</b>\n\n🔗 Реф. ссылка:\n<code>https://t.me/${ctx.botInfo.username}?start=${userId}</code>`;
                const logoPath = path.join(__dirname, 'static/images/logo.png');

                if (fs.existsSync(logoPath)) {
                    await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
                } else {
                    await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
                }
            } catch (e) { logger.error(`Bot Start Error`, e); }
        });

        // --- 5. ADMINJS & DASHBOARD ---
        const { default: AdminJS, ComponentLoader } = await import('adminjs');
        const { default: AdminJSExpress } = await import('@adminjs/express');
        const AdminJSSequelize = await import('@adminjs/sequelize');

        AdminJS.registerAdapter(AdminJSSequelize);
        const componentLoader = new ComponentLoader();
        
        const dashboardPath = path.join(__dirname, 'static', 'dashboard.jsx');
        let DASHBOARD_COMPONENT = null;
        if (fs.existsSync(dashboardPath)) {
            DASHBOARD_COMPONENT = componentLoader.add('Dashboard', dashboardPath);
        }

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
            bundler: { minify: true, force: false } // Запрет на пересборку
        });

        await adminJs.initialize();
        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-32-chars',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);

        // --- 6. ЗАПУСК МОНИТОРИНГА И ВЕБХУКА ---
        setTimeout(async () => {
            try {
                const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
                await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
                logger.system(`📡 NETWORK SECURE: WEBHOOK READY`);
            } catch (e) { logger.error("Webhook Setup Fail", e); }
        }, 12000); // 12 секунд задержки для полной готовности

    } catch (err) {
        logger.error("🚨 CRITICAL BOOT ERROR", err);
        process.exit(1); // Перезапуск контейнера при фатальной ошибке
    }
};

// Глобальная обработка ошибок (защита от падений)
process.on('unhandledRejection', (reason, promise) => logger.error('Unhandled Rejection', reason));
process.on('uncaughtException', (err) => logger.error('Uncaught Exception', err));

startEngine();
