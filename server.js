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

// Инициализация ИИ (замени ключ в переменных окружения или здесь)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY' });

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
    logger.system('🚀 NEURAL PULSE: ULTIMATE CORE V6.0');
    logger.system('══════════════════════════════════════════════════');

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));

    // --- 1. HEALTH CHECK ---
    app.get('/api/health', (req, res) => res.status(200).json({ status: 'online', uptime: process.uptime() }));
    app.use('/static', express.static(path.join(__dirname, 'static')));

    let bot;

    // Входная точка для вебхука
    app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
        if (bot) {
            bot.handleUpdate(req.body, res).catch(err => {
                if (!res.headersSent) res.sendStatus(200);
            });
        } else res.sendStatus(200);
    });

    // Запуск порта немедленно для избежания 504
    app.listen(PORT, '0.0.0.0', () => {
        logger.system(`✅ NETWORK PORT ${PORT} OPEN`);
    });

    try {
        await initDB();

        // --- 2. TELEGRAM ENGINE + AI ---
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
                    let referredBy = (refId && refId !== userId) ? refId : null;

                    if (referredBy) {
                        const referrer = await User.findByPk(referredBy);
                        if (referrer) {
                            startBalance = 5000;
                            await referrer.update({ 
                                balance: parseFloat(referrer.balance) + 10000, 
                                referrals: referrer.referrals + 1 
                            });
                            bot.telegram.sendMessage(referredBy, `✅ <b>Система:</b> Новый агент! +10,000 NP.`, { parse_mode: 'HTML' }).catch(() => {});
                        }
                    }
                    user = await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: startBalance, referred_by: referredBy });
                }

                const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${user.username}</code>\nБаланс: <b>${user.balance} NP</b>\n\n🔗 Реф. ссылка:\n<code>https://t.me/${ctx.botInfo.username}?start=${userId}</code>`;
                const logoPath = path.join(__dirname, 'static/images/logo.png');

                if (fs.existsSync(logoPath)) await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
                else await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
            } catch (e) { logger.error(`Bot Fail`, e); }
        });

        // AI Обработка сообщений
        bot.on('text', async (ctx) => {
            if (ctx.message.text.startsWith('/')) return;
            try {
                const response = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "system", content: "Ты — бортовой ИИ терминала Neural Pulse. Отвечай кратко и технично." }, { role: "user", content: ctx.message.text }],
                    max_tokens: 100
                });
                await ctx.reply(`[AI]: ${response.choices[0].message.content}`);
            } catch (e) { console.log("AI Busy"); }
        });

        // --- 3. API ЭНДПОИНТЫ ---

        // Профиль + Фарминг
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

        // Клик
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

        // Задания
        app.get('/api/tasks', async (req, res) => {
            const tasks = await Task.findAll({ where: { active: true } });
            res.json(tasks);
        });

        // --- 4. ADMINJS (ИСПРАВЛЕННЫЙ v7) ---
        setImmediate(async () => {
            try {
                const { default: AdminJS, ComponentLoader } = await import('adminjs');
                const { default: AdminJSExpress } = await import('@adminjs/express');
                const AdminJSSequelize = await import('@adminjs/sequelize');

                AdminJS.registerAdapter(AdminJSSequelize);
                const componentLoader = new ComponentLoader();
                
                const adminJs = new AdminJS({
                    resources: [
                        { resource: User, options: { navigation: { name: 'Агенты' } } },
                        { resource: Task, options: { navigation: { name: 'Контракты' } } },
                        { resource: Stats, options: { navigation: { name: 'Система' } } }
                    ],
                    rootPath: '/admin',
                    componentLoader,
                    branding: { companyName: 'Neural Pulse Hub', softwareBrothers: false },
                    bundler: { minify: true, force: false }
                });

                const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
                    authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
                    cookiePassword: 'secure-pass-2026-pulse-ultra-v6',
                }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

                app.use(adminJs.options.rootPath, adminRouter);
                await adminJs.initialize();
                logger.system("🛠 ADMIN PANEL READY");
            } catch (err) { logger.error("AdminJS fail", err); }
        });

        // Статистика
        setInterval(async () => {
            try {
                await Stats.create({
                    user_count: await User.count(),
                    server_load: parseFloat((os.loadavg()[0]).toFixed(2)),
                    mem_usage: parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2))
                });
            } catch (e) {}
        }, 600000);

        // Вебхук
        setTimeout(() => {
            bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, { drop_pending_updates: true })
                .then(() => logger.system(`📡 WEBHOOK OPERATIONAL`));
        }, 2000);

    } catch (err) {
        logger.error("🚨 CRITICAL CORE ERROR", err);
    }
};

startEngine();
