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

// --- [FIX] УБИРАЕМ ОЧИСТКУ КЭША ПРИ КАЖДОМ ЗАПУСКЕ ---
// Очистка кэша заставляет AdminJS пересобирать всё заново, что ест 300МБ+ RAM.
// Оставь это закомментированным, пока не поменяешь дизайн панели.
/*
const adminCachePath = path.join(process.cwd(), '.adminjs');
if (fs.existsSync(adminCachePath)) { ... }
*/

AdminJS.registerAdapter(AdminJSSequelize);

const componentLoader = new ComponentLoader();
// Важно: убедись, что файл static/dashboard.jsx существует, иначе упадет при сборке
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

const app = express();

// Позволяем прокси передавать заголовки
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
                        return { error: 'Offline', totalUsers: 0 };
                    }
                }
            },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                softwareBrothers: false, 
                logo: '/static/images/logo.png', // Поправил путь к лого
                theme: {
                    colors: {
                        primary100: '#00f2fe',
                        bg: '#05070a',        
                        text: '#ffffff',      
                        container: '#0d1117',
                        border: '#1a222d'
                    }
                }
            },
            // --- [FIX] ОПТИМИЗАЦИЯ ДЛЯ НИЗКОЙ ПАМЯТИ ---
            bundler: { 
                minify: true,
                force: false // НЕ пересобирать бандл, если он уже есть
            },
            assets: {
                scripts: ['https://unpkg.com/recharts/umd/Recharts.js']
            }
        };

        const adminJs = new AdminJS(adminOptions);

        // Если мы на сервере, не запускаем сборку бандла автоматически
        // Это критично для BotHost!
        if (process.env.NODE_ENV === 'production') {
            adminJs.options.bundler.force = false;
        }

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') {
                    return { email: 'admin@neuralpulse.tech' };
                }
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
                path: '/admin',
                httpOnly: true,
                secure: false // true только если есть прямой SSL на 3001, у нас прокси, оставляем false
            }
        });
        
        app.use(adminJs.options.rootPath, adminRouter);
        
        // Слушаем на 0.0.0.0, чтобы локальный прокси (bot.js) точно видел порт
        const INTERNAL_PORT = 3001;
        app.listen(INTERNAL_PORT, '0.0.0.0', () => {
            logger.info(`AdminJS Engine: INTERNAL ONLINE on port ${INTERNAL_PORT}`);
        });

    } catch (e) { 
        logger.error("Admin Boot Failure:", e); 
    }
};

startAdmin();
