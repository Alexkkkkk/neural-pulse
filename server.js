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
const ADMIN_ID = 1630132205; 
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const DASHBOARD_COMPONENT = path.join(__dirname, 'static', 'dashboard.jsx');

// Инициализация ИИ
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
    logger.system('🚀 NEURAL PULSE: ULTIMATE CORE V6.0 MONITORING');
    logger.system('══════════════════════════════════════════════════');

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '5mb' }));

    // --- 1. HEALTH CHECK & STATIC ---
    app.get('/api/health', (req, res) => res.status(200).json({ status: 'online', uptime: process.uptime() }));
    app.use('/static', express.static(path.join(__dirname, 'static')));

    let bot;

    app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
        if (bot) {
            bot.handleUpdate(req.body, res).catch(err => {
                if (!res.headersSent) res.sendStatus(200);
            });
        } else res.sendStatus(200);
    });

    app.listen(PORT, '0.0.0.0', () => {
        logger.system(`✅ NETWORK PORT ${PORT} OPEN`);
    });

    try {
        await initDB();

        // --- 2. TELEGRAM ENGINE ---
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

        // --- 3. API ЭНДПОИНТЫ ---
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

        // --- 4. ADMINJS + MONITORING HUD ---
        setImmediate(async () => {
            try {
                const { default: AdminJS, ComponentLoader } = await import('adminjs');
                const { default: AdminJSExpress } = await import('@adminjs/express');
                const AdminJSSequelize = await import('@adminjs/sequelize');

                AdminJS.registerAdapter(AdminJSSequelize);
                const componentLoader = new ComponentLoader();
                
                if (!fs.existsSync(DASHBOARD_COMPONENT)) {
                    logger.error(`❌ ОШИБКА: Файл дашборда не найден: ${DASHBOARD_COMPONENT}`);
                }

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
                            const lastStat = await Stats.findOne({ order: [['createdAt', 'DESC']] });
                            const historyData = await Stats.findAll({ limit: 15, order: [['createdAt', 'DESC']] });

                            return {
                                totalUsers,
                                cpu: lastStat ? lastStat.server_load : 0,
                                currentMem: lastStat ? lastStat.mem_usage : 0,
                                dbLatency: Math.floor(Math.random() * 10) + 2,
                                history: historyData.reverse().map(s => ({
                                    time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                    cpu: s.server_load,
                                    mem: s.mem_usage
                                }))
                            };
                        }
                    },
                    branding: { 
                        companyName: 'Neural Pulse Hub', 
                        softwareBrothers: false,
                        theme: {
                            colors: {
                                // ФИКС ТЕМНОЙ ТЕМЫ
                                bg: '#0b0e14',
                                container: '#161b22',
                                border: '#30363d',
                                text: '#ffffff',
                                title: '#00f2fe',
                                primary100: '#00f2fe',
                                
                                // Цвета для боковой панели и навигации
                                sidebar: '#0b0e14',
                                navbar: '#161b22',
                                grey100: '#ffffff',
                                grey80: '#e6edf3',
                                grey60: '#8b949e',
                                grey40: '#484f58',
                                
                                // Цвета для графиков
                                success: '#00f2fe',
                                error: '#ff4444',
                                info: '#33b5e5'
                            }
                        }
                    },
                    bundler: { minify: false, force: true },
                    watch: true 
                });

                const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
                    authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
                    cookiePassword: 'secure-pass-2026-pulse-ultra-v6-full',
                }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

                app.use(adminJs.options.rootPath, adminRouter);
                await adminJs.initialize();
                logger.system("🛠 NEURAL_PULSE_HUD: ONLINE (V6.0 DARK-CORE)");
            } catch (err) { logger.error("AdminJS fail", err); }
        });

        // --- 5. ФОНОВЫЙ МОНИТОРИНГ ---
        setInterval(async () => {
            try {
                const load = parseFloat((os.loadavg()[0] * 10).toFixed(2));
                const mem = parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2));
                const users = await User.count();
                await Stats.create({ user_count: users, server_load: load, mem_usage: mem });

                if (load > 85 && bot) {
                    bot.telegram.sendMessage(ADMIN_ID, `⚠️ <b>CRITICAL LOAD:</b> CPU ${load}%!`, { parse_mode: 'HTML' }).catch(() => {});
                }
            } catch (e) {}
        }, 300000); 

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
