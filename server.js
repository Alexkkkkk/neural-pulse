import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import cluster from 'cluster';
import os from 'os';
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

// --- ЛОГИКА РАЗДЕЛЕНИЯ ПРОЦЕССОВ (CLUSTER) С ТАЙМИНГОМ ---
if (cluster.isPrimary) {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE: CLUSTER MODE ACTIVE (V6.0)');
    logger.system('⏳ СТУПЕНЧАТЫЙ ЗАПУСК: ИНТЕРВАЛ 20 СЕКУНД');
    logger.system('══════════════════════════════════════════════════');

    // 1. Сначала запускаем только AdminJS (Worker 1)
    logger.system('🛠 [Master] Запуск Worker 1 (AdminJS)...');
    cluster.fork(); 
    
    // 2. Ждем 20 секунд, пока AdminJS соберет ресурсы и стабилизирует память
    setTimeout(() => {
        logger.system('⚡ [Master] 20 секунд прошло. Запуск Worker 2 (Bot Engine)...');
        cluster.fork(); 
    }, 20000); 

    cluster.on('exit', (worker) => {
        logger.error(`🚨 WORKER ${worker.process.pid} DIED. RESTARTING IN 10s...`);
        // Рестарт упавшего воркера тоже с задержкой 10 сек
        setTimeout(() => cluster.fork(), 10000);
    });

    setInterval(() => logSystemStats(), 60000); 

} else {
    startWorkerEngine();
}

async function startWorkerEngine() {
    const workerId = cluster.worker.id;
    const app = express();
    
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));
    app.use('/static', express.static(path.join(__dirname, 'static')));

    let bot;

    try {
        await initDB();
        bot = new Telegraf(BOT_TOKEN);

        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
            bot.handleUpdate(req.body, res).catch(err => {
                if (!res.headersSent) res.sendStatus(200);
            });
        });

        if (workerId === 1) {
            // --- WORKER 1: ADMINJS & WEBHOOK ---
            logger.system(`🛠 [Worker 1] Initializing AdminJS Hub...`);
            await setupAdminPanel(app);
            
            setTimeout(() => {
                bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, { drop_pending_updates: true })
                    .then(() => logger.system(`📡 [Worker 1] WEBHOOK OPERATIONAL`))
                    .catch(e => logger.error("Webhook fail", e));
            }, 3000);

        } else {
            // --- WORKER 2: BOT LOGIC & API ---
            logger.system(`⚡ [Worker 2] Launching Neural Bot Engine...`);
            setupBotHandlers(bot);
            setupAPIRoutes(app);
        }

        app.listen(PORT, '0.0.0.0', () => {
            logger.system(`✅ Worker ${workerId} [PID: ${process.pid}] Online on Port ${PORT}`);
        });

    } catch (err) {
        logger.error(`🚨 CRITICAL WORKER ERROR`, err);
    }
}

function setupBotHandlers(bot) {
    bot.start(async (ctx) => {
        const userId = ctx.from.id;
        const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
        const webAppUrl = `${DOMAIN}/static/index.html`;
        const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", webAppUrl)]]);

        try {
            let user = await User.findByPk(userId);
            if (!user) {
                let startBalance = 0;
                let referredBy = (refId && refId !== userId) ? refId : null;

                if (referredBy) {
                    const referrer = await User.findByPk(referredBy);
                    if (referrer) {
                        startBalance = 5000;
                        await referrer.update({ 
                            balance: parseFloat(referrer.balance) + 10000, 
                            referrals: referrer.referrals + 1 
                        });
                        bot.telegram.sendMessage(referredBy, `✅ <b>Система:</b> Новый агент в сети! +10,000 NP.`, { parse_mode: 'HTML' }).catch(() => {});
                    }
                }
                user = await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: startBalance, referred_by: referredBy });
            }

            const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${user.username}</code>\nБаланс: <b>${user.balance.toLocaleString()} NP</b>\n\n🔗 Реф. ссылка:\n<code>https://t.me/${ctx.botInfo.username}?start=${userId}</code>`;
            const logoPath = path.join(__dirname, 'static/images/logo.png');

            if (fs.existsSync(logoPath)) await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
            else await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
        } catch (e) { logger.error(`Bot Fail`, e); }
    });
}

function setupAPIRoutes(app) {
    app.get('/api/user/:id', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).send();

            const now = new Date();
            const diff = Math.floor((now - new Date(user.last_seen)) / 1000);
            
            if (diff > 60 && user.profit > 0) {
                const earned = (user.profit / 3600) * Math.min(diff, 86400);
                user.balance = parseFloat(user.balance) + earned;
                user.last_seen = now;
                user.level = calculateLevel(user.balance);
                await user.save();
            }
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
                { resource: User, options: { navigation: { name: 'Агенты' }, properties: { balance: { type: 'number' } } } },
                { resource: Task, options: { navigation: { name: 'Контракты' } } },
                { resource: Stats, options: { navigation: { name: 'Система' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: {
                component: DASHBOARD,
                handler: async () => {
                    const totalUsers = await User.count();
                    const historyData = await Stats.findAll({ limit: 20, order: [['createdAt', 'DESC']] });
                    return { 
                        totalUsers, 
                        history: historyData.reverse().map(s => ({
                            time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            cpu: s.server_load, 
                            mem: s.mem_usage
                        }))
                    };
                }
            },
            branding: { companyName: 'Neural Pulse Hub', softwareBrothers: false },
            bundler: { minify: false, force: true }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-v6-full',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);
        await adminJs.initialize();
        logger.system("🛠 ADMIN PANEL READY [DARK-CORE V6]");
    } catch (err) { logger.error("AdminJS fail", err); }
}
