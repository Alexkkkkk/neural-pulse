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

logger.info("[ADMIN_INIT] Старт процесса инициализации...");

AdminJS.registerAdapter(AdminJSSequelize);
const componentLoader = new ComponentLoader();

const startAdmin = async () => {
    try {
        logger.info("[ADMIN_STEP] Настройка опций AdminJS...");
        const adminOptions = {
            resources: [
                { resource: User }, { resource: Task }, { resource: Stats }
            ],
            rootPath: '/admin',
            componentLoader,
            bundler: { minify: false, force: false } // КРИТИЧНО ДЛЯ СКОРОСТИ
        };

        const adminJs = new AdminJS(adminOptions);
        
        logger.info("[ADMIN_STEP] Сборка роутера (Authenticated)...");
        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin@np.tech' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-secret-32-chars',
        }, null, {
            resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore,
            cookie: { maxAge: 86400000, path: '/admin', secure: false }
        });

        const app = express();
        app.use(adminJs.options.rootPath, adminRouter);

        logger.info("[ADMIN_STEP] Запуск прослушивания порта 3001...");
        app.listen(3001, '0.0.0.0', () => {
            logger.system("✅ [ADMIN_READY] Админка доступна на внутреннем порту 3001");
            if (process.send) process.send('ready');
        });

    } catch (e) {
        logger.error(`[ADMIN_FATAL] Ошибка при сборке админки: ${e.stack}`);
    }
};

startAdmin();
