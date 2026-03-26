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
// Очистка кэша фронтенда для принудительного обновления дизайна
const adminCachePath = path.join(process.cwd(), '.adminjs');
if (fs.existsSync(adminCachePath)) {
    try {
        fs.rmSync(adminCachePath, { recursive: true, force: true });
        logger.info("AdminJS: Static cache purged successfully.");
    } catch (e) {
        logger.warn("AdminJS: Cache purge skipped.");
    }
}

AdminJS.registerAdapter(AdminJSSequelize);

const componentLoader = new ComponentLoader();
// Регистрация киберпанк-дашборда
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

const app = express();

// --- МИДЛВАРЫ ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Раздача статики (логотипы, картинки, стили)
app.use('/static', express.static(path.join(__dirname, 'static')));

// --- РОУТИНГ ---
app.get('/', (req, res) => {
    res.redirect('/admin');
});

app.get('/logout', (req, res) => {
    res.redirect('/admin/logout');
});

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
                        return { error: 'Telemetry Offline', totalUsers: 0 };
                    }
                }
            },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                softwareBrothers: false, 
                logo: '/static/logo.png',
                theme: {
                    colors: {
                        primary100: '#00f2fe',
                        bg: '#05070a',        
                        text: '#ffffff',      
                        container: '#0d1117',
                        border: '#1a222d'
                    }
                },
                custom: {
                    style: `
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                        body, #adminjs-app {
                            background: radial-gradient(circle at center, #0a111a 0%, #05070a 100%) !important;
                            font-family: 'Inter', sans-serif !important;
                        }
                        section[data-testid="login"] {
                            background: #0d1117 !important;
                            border: 1px solid #00f2fe !important;
                            box-shadow: 0 0 30px rgba(0, 242, 254, 0.2) !important;
                            border-radius: 16px !important;
                        }
                        input {
                            background: #161b22 !important;
                            border: 1px solid #30363d !important;
                            color: #ffffff !important;
                            border-radius: 8px !important;
                        }
                        button[type="submit"] {
                            background: #00f2fe !important;
                            color: #000000 !important;
                            font-weight: 900 !important;
                            text-transform: uppercase !important;
                            letter-spacing: 1px !important;
                            border-radius: 8px !important;
                        }
                        button[type="submit"]:hover {
                            background: #ffffff !important;
                            box-shadow: 0 0 20px #00f2fe !important;
                        }
                    `
                }
            },
            bundler: {
                minify: true 
            },
            // ВАЖНО: Подгрузка внешних скриптов для работы графиков Recharts
            assets: {
                scripts: [
                    'https://unpkg.com/recharts/umd/Recharts.js'
                ]
            }
        };

        const adminJs = new AdminJS(adminOptions);

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') {
                    logger.info(`AdminJS: Authorized access granted to root`);
                    return { email: 'admin@neuralpulse.tech' };
                }
                logger.warn(`AdminJS: Failed login attempt: ${email}`);
                return null;
            },
            cookiePassword: 'secure-pass-2026-pulse-ultra-secret-32-chars',
        }, null, {
            resave: false, 
            saveUninitialized: false, 
            secret: 'neural_pulse_secret_2026',
            store: sessionStore,
            cookie: { 
                maxAge: 86400000,
                path: '/admin'
            }
        });
        
        app.use(adminJs.options.rootPath, adminRouter);
        
        app.listen(3001, '0.0.0.0', () => {
            logger.info("AdminJS Engine: ONLINE on port 3001");
        });

    } catch (e) { 
        logger.error("Admin Boot Failure:", e); 
    }
};

startAdmin();
