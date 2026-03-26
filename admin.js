import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import AdminJS, { ComponentLoader } from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { sequelize, sessionStore, User, Task, Stats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSSequelize);
const componentLoader = new ComponentLoader();
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

const startAdmin = async () => {
    try {
        const adminOptions = {
            resources: [
                { resource: User, options: { navigation: { name: 'Агенты', icon: 'User' } } }, 
                { resource: Task, options: { navigation: { name: 'Миссии', icon: 'Task' } } }, 
                { resource: Stats, options: { navigation: { name: 'Система', icon: 'Settings' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            dashboard: {
                component: DASHBOARD_COMPONENT,
                handler: async () => {
                    const totalUsers = await User.count();
                    return { totalUsers, currentMem: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), cpu: (os.loadavg()[0] * 10).toFixed(1) };
                }
            },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                logo: '/static/images/logo.png',
                softwareBrothers: false,
                theme: {
                    id: 'np-dark',
                    colors: { primary100: '#00f2fe', bg: '#05070a', text: '#ffffff', container: '#0d1117' }
                },
                customCSS: `
                    :root { --colors-bg: #05070a !important; --colors-primary100: #00f2fe !important; }
                    body, #adminjs, section[data-testid="sidebar"] { background: #05070a !important; }
                    [data-testid="login"] > div:first-child { background: #0a0a0a !important; border-right: 2px solid #00f2fe !important; }
                `
            },
            bundler: { 
                // САМАЯ ВАЖНАЯ СТРОЧКА ДЛЯ BOTHOST:
                minify: false, // Отключает тяжелую компиляцию, спасает CPU и RAM
                force: false   
            }
        };

        const adminJs = new AdminJS(adminOptions);
        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => (email === '1' && password === '1') ? { email: 'admin@np.tech' } : null,
            cookiePassword: 'secure-pass-2026-pulse-ultra-secret-32-chars',
        }, null, {
            resave: false, saveUninitialized: false, secret: 'np_secret', store: sessionStore,
            cookie: { maxAge: 86400000, path: '/admin', httpOnly: true, secure: false }
        });
        
        app.use(adminJs.options.rootPath, adminRouter);
        app.listen(3001, '0.0.0.0', () => {
            logger.info(`AdminJS Engine: INTERNAL ONLINE (3001)`);
            if (process.send) process.send('ready');
        });
    } catch (e) { logger.error("Admin Boot Failure:", e); }
};
startAdmin();
