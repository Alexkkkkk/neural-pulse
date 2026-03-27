import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import OpenAI from 'openai';

// 1. Импортируем типы напрямую из библиотеки sequelize
import { DataTypes, Op } from 'sequelize'; 

// 2. Импорты модулей БД и логов
import { sequelize, User, Task, Stats, sessionStore, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const ADMIN_ID = 1774360651;

// Инициализация ИИ
const openai = new OpenAI({ apiKey: 'YOUR_OPENAI_API_KEY' });

// Функция расчета уровня
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
    logger.system('🚀 NEURAL PULSE: ULTIMATE V5.1 ACTIVATED');
    logger.system('══════════════════════════════════════════════════');

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: true }));

    // --- 1. МГНОВЕННЫЙ HEALTH-CHECK ---
    app.get('/api/health', (req, res) => {
        res.send(`<html><body style="background:#05070a;color:#00f2fe;font-family:monospace;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
            <div style="border:2px solid #00f2fe;padding:20px;box-shadow:0 0 15px #00f2fe;">
                <h2>> NP_CORE: ONLINE</h2>
                <p>UPTIME: ${Math.floor(process.uptime())}s | MEM: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)}MB</p>
                <script>setTimeout(() => location.reload(), 3000);</script>
            </div></body></html>`);
    });

    app.use('/static', express.static(path.join(__dirname, 'static')));

    // --- 2. СТАРТ ПОРТА ---
    const server = app.listen(PORT, '0.0.0.0', () => {
        logger.system(`✅ PORT ${PORT} OPEN. INITIALIZING CORE...`);
    });

    try {
        // --- 3. ИНИЦИАЛИЗАЦИЯ БД ---
        await initDB();
        logger.info("CORE_DB: CONNECTED");

        // --- 4. TELEGRAM BOT ---
        const bot = new Telegraf(BOT_TOKEN);

        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
            bot.handleUpdate(req.body, res).catch(err => {
                if (!res.headersSent) res.sendStatus(200);
            });
        });

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

                const caption = `<b>Neural Pulse | Terminal</b>\n\nИдентификация: <code>${user.username}</code>\nБаланс: <b>${user.balance} NP</b>\n\n🔗 Реф. ссылка:\n<code>https://t.me/${ctx.botInfo.username}?start=${userId}</code>`;
                const logoPath = path.join(__dirname, 'static/images/logo.png');

                if (fs.existsSync(logoPath)) {
                    await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
                } else {
                    await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
                }
            } catch (e) { logger.error(`Bot Fail`, e); }
        });

        // --- 5. API С АВТО-ФЕРМОЙ ---
        app.get('/api/user/:id', async (req, res) => {
            try {
                let user = await User.findByPk(req.params.id);
                if (!user) return res.status(404).send("NOT_FOUND");

                const now = new Date();
                const secondsOffline = Math.floor((now - new Date(user.last_seen)) / 1000);

                if (secondsOffline > 60 && user.profit > 0) {
                    const farmTime = Math.min(secondsOffline, 86400); 
                    const earned = (user.profit / 3600) * farmTime; 
                    user.balance = parseFloat(user.balance) + parseFloat(earned.toFixed(2));
                    user.last_seen = now;
                    user.level = calculateLevel(user.balance);
                    await user.save();
                }
                res.json(user);
            } catch (e) { res.status(500).send("API_ERR"); }
        });

        // --- 6. ADMINJS (ИСПРАВЛЕННЫЙ БЛОК) ---
        const { default: AdminJS } = await import('adminjs');
        const { default: AdminJSExpress } = await import('@adminjs/express');
        const AdminJSSequelize = await import('@adminjs/sequelize');

        // В v7 ComponentLoader берется напрямую из AdminJS
        const ComponentLoader = AdminJS.ComponentLoader; 
        AdminJS.registerAdapter(AdminJSSequelize);
        
        const componentLoader = new ComponentLoader();
        const DASHBOARD = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Агенты' } } },
                { resource: Task, options: { navigation: { name: 'Контракты' } } },
                { resource: Stats, options: { navigation: { name: 'Система' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: { component: DASHBOARD },
            branding: { companyName: 'Neural Pulse Hub', logo: '/static/images/logo.png', softwareBrothers: false },
            bundler: { minify: true, force: false }
        });

        await adminJs.initialize();
        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-32-chars',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);

        // --- 7. ФОНОВЫЕ ПРОЦЕССЫ ---
        setInterval(async () => {
            try {
                const metrics = {
                    user_count: await User.count(),
                    server_load: parseFloat((os.loadavg()[0] * 10).toFixed(2)),
                    mem_usage: parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2))
                };
                await Stats.create(metrics);
            } catch (e) { logger.error("Stats fail", e); }
        }, 15 * 60 * 1000);

        setTimeout(async () => {
            const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
            await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
            logger.system(`📡 WEBHOOK & AI MONITORING ACTIVE`);
        }, 5000);

    } catch (err) {
        logger.error("CRITICAL BOOT ERROR", err);
    }
};

startEngine();
