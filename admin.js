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
// Важно: проверь наличие файла static/dashboard.jsx
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));

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
                        const totalUsers = await User.count();
                        return {
                            totalUsers,
                            currentMem: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
                            cpu: (os.loadavg()[0] * 10).toFixed(1)
                        };
                    } catch (err) {
                        return { error: 'Offline', totalUsers: 0 };
                    }
                }
            },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                softwareBrothers: false, 
                logo: '/static/images/logo.png',
                theme: {
                    colors: {
                        primary100: '#00f2fe',
                        bg: '#05070a',        
                        text: '#ffffff',      
                        container: '#0d1117',
                        border: '#1a222d',
                        loginBg: '#05070a'
                    }
                },
                customCSS: `
                    [data-testid="login"] { background: radial-gradient(circle, #0d1117 0%, #05070a 100%) !important; }
                    [data-testid="login"] > div:first-child { background: #0a0a0a !important; border-right: 2px solid #00f2fe !important; }
                    [data-testid="login"] h2 { color: #00f2fe !important; font-family: 'Courier New', monospace; text-transform: uppercase; }
                    .sc-fubCfw.button.is-primary { background: #00f2fe !important; color: #000 !important; font-weight: bold; }
                    input { background: #0d1117 !important; color: #00f2fe !important; border: 1px solid #1a222d !important; }
                `
            },
            bundler: { minify: true, force: false },
            assets: { scripts: ['https://unpkg.com/recharts/umd/Recharts.js'] }
        };

        const adminJs = new AdminJS(adminOptions);

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') return { email: 'admin@neuralpulse.tech' };
                return null;
            },
            cookiePassword: 'secure-pass-2026-pulse-ultra-secret-32-chars',
        }, null, {
            resave: false, 
            saveUninitialized: false, 
            secret: 'neural_pulse_secret_2026',
            store: sessionStore,
            cookie: { maxAge: 86400000, path: '/admin', httpOnly: true, secure: false }
        });
        
        app.use(adminJs.options.rootPath, adminRouter);
        
        const INTERNAL_PORT = 3001;
        // Слушаем на 0.0.0.0 чтобы быть доступными внутри сети
        app.listen(INTERNAL_PORT, '0.0.0.0', () => {
            logger.info(`AdminJS Engine: INTERNAL ONLINE on port ${INTERNAL_PORT}`);
            if (process.send) process.send('ready');
        });

    } catch (e) { 
        logger.error("Admin Boot Failure:", e); 
    }
};

startAdmin();
