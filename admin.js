import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs'; 
import AdminJS, { ComponentLoader } from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { sequelize, sessionStore, User, Task, Stats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ПРЕДУСТАНОВКА СИСТЕМЫ ---
// Очистка кеша фронтенда перед сборкой, чтобы избежать ошибок отображения (розовый экран)
const adminCachePath = path.join(process.cwd(), '.adminjs');
if (fs.existsSync(adminCachePath)) {
    try {
        fs.rmSync(adminCachePath, { recursive: true, force: true });
        logger.info("AdminJS: Static cache purged successfully.");
    } catch (e) {
        logger.warn("AdminJS: Cache purge skipped or failed.");
    }
}

AdminJS.registerAdapter(AdminJSSequelize);

const componentLoader = new ComponentLoader();
// Путь к файлу в корне (согласно твоей структуре на скриншоте)
const dashboardPath = path.join(__dirname, 'dashboard-component.jsx');
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', dashboardPath);

const app = express();

const startAdmin = async () => {
    try {
        const adminOptions = {
            resources: [
                { 
                    resource: User, 
                    options: { 
                        navigation: { name: 'Агенты', icon: 'User' },
                        properties: { 
                            last_seen: { isVisible: { list: true, edit: false, filter: true } },
                            createdAt: { isVisible: { list: true, filter: true, show: true, edit: false } }
                        }
                    } 
                }, 
                { resource: Task, options: { navigation: { name: 'Миссии', icon: 'Task' } } }, 
                { resource: Stats, options: { navigation: { name: 'Система', icon: 'Settings' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: {
                component: DASHBOARD_COMPONENT,
                handler: async () => {
                    try {
                        const startDb = Date.now();
                        await sequelize.query('SELECT 1');
                        const dbLatency = Date.now() - startDb;
                        const totalUsers = await User.count();
                        
                        return {
                            totalUsers,
                            dbLatency,
                            currentMem: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
                            cpu: (os.loadavg()[0] * 10).toFixed(1)
                        };
                    } catch (err) {
                        logger.error("Admin Telemetry Error:", err);
                        return { error: 'Telemetry Offline' };
                    }
                }
            },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                softwareBrothers: false,
                theme: {
                    colors: {
                        primary100: '#00f2fe', // Кибер-голубой
                        bg: '#05070a',        
                        text: '#ffffff',      
                        container: '#0d1117'
                    }
                }
            },
            bundler: {
                minify: process.env.NODE_ENV === 'production'
            }
        };

        const adminJs = new AdminJS(adminOptions);

        // Настройка авторизации (Логин: 1, Пароль: 1)
        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') {
                    logger.system(`AdminJS: Authorized access by root`);
                    return { email: 'admin@neuralpulse.tech' };
                }
                logger.warn(`AdminJS: Unauthorized login attempt: ${email}`);
                return null;
            },
            cookiePassword: 'secure-pass-2026-pulse-ultra-secret',
        }, null, {
            resave: false, 
            saveUninitialized: false, 
            secret: 'neural_pulse_secret_2026',
            store: sessionStore,
            cookie: { maxAge: 86400000 }
        });
        
        app.use(adminJs.options.rootPath, adminRouter);
        
        app.listen(3001, '0.0.0.0', () => {
            logger.system("AdminJS interface: ONLINE on port 3001");
        });

    } catch (e) { 
        logger.error("Admin Boot Failure:", e); 
    }
};

startAdmin();
