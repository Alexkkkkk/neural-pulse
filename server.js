import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

// Импорты твоих модулей БД и логов
import { sequelize, User, Task, Stats, sessionStore, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- КОНФИГУРАЦИЯ ---
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;

AdminJS.registerAdapter(AdminJSSequelize);

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE: МОНОЛИТНАЯ СИНХРОНИЗАЦИЯ...');
    logger.system('══════════════════════════════════════════════════');

    try {
        // 1. БД
        await initDB();
        logger.info("CORE_DB: ПОДКЛЮЧЕНО");

        const app = express();
        app.set('trust proxy', 1);
        app.use(cors());
        app.use(express.json());
        
        // Статика
        app.use('/static', express.static(path.join(__dirname, 'static')));

        // 2. Инициализация AdminJS (внутри того же процесса)
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Агенты' } } },
                { resource: Task, options: { navigation: { name: 'Миссии' } } },
                { resource: Stats, options: { navigation: { name: 'Система' } } }
            ],
            rootPath: '/admin',
            branding: { 
                companyName: 'Neural Pulse Hub', 
                logo: '/static/images/logo.png',
                softwareBrothers: false 
            },
            bundler: { minify: true, force: false }
        });

        // Билдим админку
        await adminJs.initialize();
        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-32-chars',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

        app.use(adminJs.options.rootPath, adminRouter);

        // 3. Инициализация Бота
        const bot = new Telegraf(BOT_TOKEN);
        
        bot.start(async (ctx) => {
            const userId = ctx.from.id;
            const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]]);
            const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${ctx.from.username || 'AGENT'}</code>\nСтатус: <b>ONLINE</b>`;
            const logoPath = path.join(__dirname, 'static/images/logo.png');

            try {
                await User.findOrCreate({ where: { id: BigInt(userId) }, defaults: { username: ctx.from.username || 'AGENT' } });
                if (fs.existsSync(logoPath)) {
                    await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
                } else {
                    await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
                }
            } catch (e) { logger.error(`Bot Error: ${e.message}`); }
        });

        // Хендлер вебхука (теперь напрямую в app)
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
            bot.handleUpdate(req.body);
            res.sendStatus(200);
        });

        // 4. Запуск единого сервера
        app.listen(PORT, async () => {
            logger.system(`✅ МОНОЛИТ АКТИВИРОВАН: Port ${PORT}`);
            
            // Установка Webhook
            try {
                const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
                await bot.telegram.setWebhook(webhookUrl);
                logger.system(`📡 WEBHOOK УСТАНОВЛЕН -> ${webhookUrl}`);
            } catch (e) {
                logger.error(`Webhook Fail: ${e.message}`);
            }
        });

    } catch (err) {
        logger.error("КРИТИЧЕСКИЙ СБОЙ МОНОЛИТА", err);
        process.exit(1);
    }
};

startEngine();
