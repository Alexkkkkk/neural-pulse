import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import { sequelize, User, Task, Stats, sessionStore, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;

let bot;

const startEngine = async () => {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // 1. Мгновенный порт
    app.listen(PORT, '0.0.0.0', () => logger.system(`🚀 PORT ${PORT} ACTIVE`));

    // 2. Мгновенный роут вебхука
    app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
        if (bot && bot.handleUpdate) {
            bot.handleUpdate(req.body, res).catch(() => res.sendStatus(200));
        } else {
            res.sendStatus(200);
        }
    });

    try {
        await initDB();
        
        // 3. Сначала БОТ
        bot = new Telegraf(BOT_TOKEN);
        bot.start(async (ctx) => {
            try {
                const userId = ctx.from.id;
                let user = await User.findByPk(userId);
                if (!user) {
                    user = await User.create({ id: userId, username: ctx.from.username || 'AGENT' });
                }
                const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ", `${DOMAIN}/static/index.html`)]]);
                await ctx.reply(`<b>Neural Pulse Активен</b>\nБаланс: ${user.balance} NP`, { parse_mode: 'HTML', ...keyboard });
            } catch (e) { logger.error("Start Err", e); }
        });

        // Ставим вебхук быстро
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, { drop_pending_updates: true });
        logger.system("📡 BOT READY");

        // 4. Админка запускается ПОСЛЕДНЕЙ и асинхронно
        process.nextTick(async () => {
            try {
                const { default: AdminJS } = await import('adminjs');
                const { default: AdminJSExpress } = await import('@adminjs/express');
                const AdminJSSequelize = await import('@adminjs/sequelize');
                AdminJS.registerAdapter(AdminJSSequelize);

                const adminJs = new AdminJS({
                    resources: [{ resource: User }, { resource: Task }, { resource: Stats }],
                    rootPath: '/admin',
                    branding: { companyName: 'Neural Pulse' },
                    bundler: { minify: true, force: false } 
                });

                const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
                    authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
                    cookiePassword: 'super-secret-password-1234567890123456',
                }, null, { resave: false, saveUninitialized: false, secret: 'np', store: sessionStore });

                app.use(adminJs.options.rootPath, adminRouter);
                await adminJs.initialize();
                logger.system("🛠 ADMIN READY");
            } catch (err) { logger.error("Admin Load Fail", err); }
        });

    } catch (err) { logger.error("Global Fail", err); }
};

startEngine();
