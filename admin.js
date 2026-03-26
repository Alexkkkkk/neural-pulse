import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { sequelize, sessionStore, User, Task, Stats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSSequelize);

const startAdmin = async () => {
    try {
        logger.info("[ADMIN] Настройка интерфейса...");
        const adminJs = new AdminJS({
            resources: [{ resource: User }, { resource: Task }, { resource: Stats }],
            rootPath: '/admin',
            bundler: { minify: false, force: false } // КРИТИЧЕСКИ ВАЖНО
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin@np.tech' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-secret-32-chars',
        }, null, {
            resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore,
            cookie: { maxAge: 86400000, path: '/admin', secure: false }
        });

        const app = express();
        app.use(adminJs.options.rootPath, adminRouter);

        app.listen(3001, '0.0.0.0', () => {
            logger.system("✅ [ADMIN] Порт 3001 открыт.");
            if (process.send) process.send('ready');
        });
    } catch (e) { logger.error(`[ADMIN_ERR] ${e.stack}`); }
};

startAdmin();
