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

// Регистрация адаптера для работы с Sequelize
AdminJS.registerAdapter(AdminJSSequelize);

const componentLoader = new ComponentLoader();
// Указываем путь к кастомному дашборду. Путь должен быть идентичен тому, что в Dockerfile.
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Раздача статики (логотипы, стили)
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
                    return { 
                        totalUsers, 
                        currentMem: (process.memoryUsage().rss / 1024 / 1024).toFixed(1), 
                        cpu: (os.loadavg()[0]).toFixed(2)
                    };
                }
            },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                logo: '/static/images/logo.png',
                softwareBrothers: false, // Убираем логотип разработчиков AdminJS
                theme: {
                    id: 'np-dark',
                    colors: { 
                        primary100: '#00f2fe', 
                        bg: '#05070a', 
                        text: '#ffffff', 
                        container: '#0d1117' 
                    }
                },
                customCSS: `
                    :root { --colors-bg: #05070a !important; --colors-primary100: #00f2fe !important; }
                    body, #adminjs, section[data-testid="sidebar"] { background: #05070a !important; }
                    [data-testid="login"] > div:first-child { background: #0a0a0a !important; border-right: 2px solid #00f2fe !important; }
                    /* Скрытие лишних элементов для ускорения рендеринга */
                    button[data-testid="button-fingerprint"] { display: none; }
                `
            },
            // --- КРИТИЧЕСКАЯ СЕКЦИЯ ОПТИМИЗАЦИИ ---
            bundler: { 
                minify: true, 
                force: false, // ВАЖНО: false заставляет использовать уже собранный бандл из Docker-слоя
                babelConfig: {
                    compact: true,
                    presets: [
                        ['@babel/preset-react', { runtime: 'automatic' }],
                        ['@babel/preset-env', { targets: { node: 'current' } }]
                    ]
                }
            }
        };

        const adminJs = new AdminJS(adminOptions);

        // Настройка авторизации
        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                // Простая проверка (в будущем можно заменить на поиск в БД)
                if (email === '1' && password === '1') {
                    return { email: 'admin@np.tech' };
                }
                return null;
            },
            cookiePassword: 'secure-pass-2026-pulse-ultra-secret-32-chars',
        }, null, {
            resave: false, 
            saveUninitialized: false, 
            secret: 'np_secret', 
            store: sessionStore,
            cookie: { 
                maxAge: 86400000, // 24 часа
                path: '/admin', 
                httpOnly: true, 
                secure: false // Bothost использует прокси, оставляем false если нет прямого SSL на ноде
            }
        });
        
        app.use(adminJs.options.rootPath, adminRouter);

        // Запуск сервера на внутреннем порту 3001
        // Используем 127.0.0.1, так как доступ идет только через прокси в bot.js
        app.listen(3001, '127.0.0.1', () => {
            logger.info(`AdminJS Engine: INTERNAL ONLINE (3001)`);
            // Отправка сигнала "ready" родительскому процессу (server.js)
            if (process.send) {
                process.send('ready');
            }
        });

    } catch (e)
