import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import OpenAI from 'openai';
import { DataTypes, Op } from 'sequelize'; 

// 1. Импорты БД и логов
import { sequelize, User, Task, Stats, sessionStore, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: 'YOUR_OPENAI_API_KEY' });

// Уровни агентов
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
    logger.system('🚀 NEURAL PULSE: FULL OPERATIONAL CORE');
    logger.system('══════════════════════════════════════════════════');

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));

    // --- 1. HEALTH & WEBHOOK ROUTE (МГНОВЕННЫЙ ОТВЕТ) ---
    app.get('/api/health', (req, res) => res.status(200).json({ status: 'active', mem: (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + 'MB' }));

    let bot; // Инициализируем позже

    app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
        if (bot) {
            bot.handleUpdate(req.body, res).catch(err => {
                if (!res.headersSent) res.sendStatus(200);
            });
        } else {
            res.sendStatus(200);
        }
    });

    app.use('/static', express.static(path.join(__dirname, 'static')));

    // --- 2. СТАРТ ПОРТА ---
    app.listen(PORT, '0.0.0.0', () => {
        logger.system(`✅ NETWORK PORT ${PORT} OPEN`);
    });

    try {
        await initDB();
        
        // --- 3. TELEGRAM ENGINE ---
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

                const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${user.username}</code>\nБаланс: <b>${user.balance} NP</b>\nУровень: <b>${user.level}</b>\n\n🔗 Реф. ссылка:\n<code>https://t.me/${ctx.botInfo.username}?start=${userId}</code>`;
                const logoPath = path.join(__dirname, 'static/images/logo.png');

                if (fs.existsSync(logoPath)) await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
                else await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
            } catch (e) { logger.error(`Bot Start Error`, e); }
        });

        // --- 4. API ЭНДПОИНТЫ ДЛЯ WEBAPP ---
        
        // Получение данных пользователя + Авто-ферма
        app.get('/api/user/:id', async (req, res) => {
            try {
                let user = await User.findByPk(req.params.id);
                if (!user) return res.status(404).json({ error: "Not found" });

                const now = new Date();
                const secondsOffline = Math.floor((now - new Date(user.last_seen)) / 1000);

                // Если был офлайн больше минуты и есть доход в час
                if (secondsOffline > 60 && user.profit > 0) {
                    const farmTime = Math.min(secondsOffline, 86400); // Макс 24 часа
                    const earned = (user.profit / 3600) * farmTime; 
                    user.balance = parseFloat(user.balance) + parseFloat(earned.toFixed(2));
                    user.last_seen = now;
                    user.level = calculateLevel(user.balance);
                    await user.save();
                }
                res.json(user);
            } catch (e) { res.status(500).json({ error: "DB Error" }); }
        });

        // Клик (Тап)
        app.post('/api/click', async (req, res) => {
            const { userId, count } = req.body;
            try {
                const user = await User.findByPk(userId);
                if (user) {
                    const reward = count * (1 + (user.level * 0.2)); // Бонус за уровень
                    user.balance = parseFloat(user.balance) + reward;
                    user.last_seen = new Date();
                    await user.save();
                    return res.json({ balance: user.balance });
                }
                res.status(404).send();
            } catch (e) { res.status(500).send(); }
        });

        // --- 5. ADMINJS (В ФОНОВОМ РЕЖИМЕ) ---
        setImmediate(async () => {
            try {
                const { default: AdminJS } = await import('adminjs');
                const { default: AdminJSExpress } = await import('@adminjs/express');
                const AdminJSSequelize = await import('@adminjs/sequelize');

                AdminJS.registerAdapter(AdminJSSequelize);
                const componentLoader = new AdminJS.ComponentLoader();
                
                const adminJs = new AdminJS({
                    resources: [
                        { resource: User, options: { navigation: { name: 'Агенты' } } },
                        { resource: Task, options: { navigation: { name: 'Контракты' } } },
                        { resource: Stats, options: { navigation: { name: 'Система' } } }
                    ],
                    rootPath: '/admin',
                    componentLoader,
                    branding: { companyName: 'Neural Pulse Hub', logo: '/static/images/logo.png', softwareBrothers: false },
                    bundler: { minify: true, force: false }
                });

                const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
                    authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
                    cookiePassword: 'secure-pass-2026-pulse-ultra-32-chars',
                }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

                app.use(adminJs.options.rootPath, adminRouter);
                await adminJs.initialize();
                logger.system("🛠 ADMIN PANEL READY");
            } catch (err) { logger.error("AdminJS fail", err); }
        });

        // --- 6. ФОНОВАЯ СТАТИСТИКА (Каждые 15 мин) ---
        setInterval(async () => {
            try {
                await Stats.create({
                    user_count: await User.count(),
                    server_load: parseFloat((os.loadavg()[0] * 10).toFixed(2)),
                    mem_usage: parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2))
                });
            } catch (e) { logger.error("Stats error", e); }
        }, 900000);

        // Установка вебхука
        setTimeout(() => {
            bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, { drop_pending_updates: true })
                .then(() => logger.system(`📡 WEBHOOK OPERATIONAL`))
                .catch(e => logger.error("Webhook error", e));
        }, 3000);

    } catch (err) {
        logger.error("🚨 CRITICAL CORE ERROR", err);
    }
};

startEngine();
