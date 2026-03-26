import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import AdminJS, { ComponentLoader } from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { sequelize, sessionStore, User, Task, Stats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSSequelize);
const componentLoader = new ComponentLoader();
const DASHBOARD = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

const startAdmin = async () => {
    try {
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

        logger.info("AdminJS: Инициализация компонентов...");
        await adminJs.initialize(); 

        const app = express();
        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-32-chars',
        }, null, { resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore });

        app.use(adminJs.options.rootPath, router);
        app.listen(3001, () => {
            logger.info("AdminJS: Внутренний порт 3001 открыт");
            if (process.send) process.send('ready'); // Посылаем сигнал Ядру
        });
    } catch (e) {
        logger.error("Admin Fail", e);
        process.exit(1);
    }
};

startAdmin();
