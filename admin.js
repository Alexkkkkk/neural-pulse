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
// Очистка кеша фронтенда для избежания "розового экрана" при обновлении JSX
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
// Путь к твоему киберпанк-дашборду в папке static
const dashboardPath = path.join(__dirname, 'static', 'dashboard.jsx');
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', dashboardPath);

const app = express();

// --- МИДЛВАРЫ (Решают проблему Cannot POST /login) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Раздача статики (логотипы, картинки)
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
                        logger.error("Admin Telemetry Error:", err);
                        return { error: 'Telemetry Offline', totalUsers: 0 };
                    }
                }
            },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                softwareBrothers: false,
                // Путь к логотипу из твоей папки static/images
                logo: '/static/images/logo.png',
                theme: {
                    colors: {
                        primary100: '#00f2fe',
                        bg: '#05070a',        
                        text: '#ffffff',      
                        container: '#0d1117',
                        border: '#1a222d'
                    }
                },
                // КИБЕРПАНК-СТИЛИЗАЦИЯ СТРАНИЦЫ ВХОДА
                custom: {
                    style: `
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');

                        body, #adminjs-app {
                            background: radial-gradient(circle at center, #0a111a 0%, #05070a 100%) !important;
                            font-family: 'Inter', sans-serif !important;
                        }

                        /* Карточка логина */
                        section[data-testid="login"] {
                            background: #0d1117 !important;
                            border: 1px solid #00f2fe !important;
                            box-shadow: 0 0 30px rgba(0, 242, 254, 0.25) !important;
                            border-radius: 20px !important;
                            overflow: hidden;
                        }

                        /* Левая декоративная панель */
                        section[data-testid="login"] > div:first-child {
                            background: linear-gradient(135deg, #001a1d 0%, #00f2fe 100%) !important;
                        }

                        /* Поля ввода (Email/Password) */
                        input {
                            background: #161b22 !important;
                            border: 1px solid #30363d !important;
                            color: #ffffff !important;
                            border-radius: 10px !important;
                            padding: 12px !important;
                        }

                        input:focus {
                            border-color: #00f2fe !important;
                            box-shadow: 0 0 10px rgba(0, 242, 254, 0.5) !important;
                        }

                        /* Кнопка входа */
                        button[type="submit"] {
                            background: #00f2fe !important;
                            color: #000000 !important;
                            font-weight: 900 !important;
                            text-transform: uppercase !important;
                            letter-spacing: 2px !important;
                            border-radius: 10px !important;
                            height: 50px !important;
                            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                        }

                        button[type="submit"]:hover {
                            background: #ffffff !important;
                            box-shadow: 0 0 25px #00f2fe !important;
                            transform: translateY(-3px) scale(1.02);
                        }

                        /* Названия полей и заголовки */
                        p, label, h3 {
                            color: #ffffff !important;
                        }
                        
                        /* Стилизация логотипа */
                        img {
                            filter: drop-shadow(0 0 5px #00f2fe);
                        }
                    `
                }
            },
            bundler: {
                minify: true 
            }
        };

        const adminJs = new AdminJS(adminOptions);

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                // Твои доступы 1 / 1
                if (email === '1' && password === '1') {
                    logger.system(`AdminJS: Authorized access granted to root`);
                    return { email: 'admin@neuralpulse.tech' };
                }
                logger.warn(`AdminJS: Failed login attempt for user: ${email}`);
                return null;
            },
            cookiePassword: 'secure-pass-2026-pulse-ultra-secret',
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
        
        // Запуск на порту 3001
        app.listen(3001, '0.0.0.0', () => {
            logger.system("AdminJS Engine: ONLINE on port 3001");
        });

    } catch (e) { 
        logger.error("Admin Boot Failure:", e); 
    }
};

startAdmin();
