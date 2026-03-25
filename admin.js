import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Op } from 'sequelize';
import os from 'os';
import fs from 'fs'; 
import AdminJS, { ComponentLoader } from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { sequelize, sessionStore, User, Task, Stats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSSequelize);
const componentLoader = new ComponentLoader();

// Путь к твоему JSX файлу
const dashboardPath = path.join(__dirname, 'static', 'dashboard.jsx');

// Регистрируем компонент через Loader (ЭТО ВАЖНО)
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
            componentLoader, // Обязательно передаем лоадер сюда
            dashboard: {
                component: DASHBOARD_COMPONENT, // Ссылка на зарегистрированный ID
                handler: async () => {
                    // Сбор данных для графиков
                    try {
                        const startDb = Date.now();
                        await sequelize.query('SELECT 1');
                        const dbLatency = Date.now() - startDb;
                        const totalUsers = await User.count();
                        const newUsers24h = await User.count({
                            where: { createdAt: { [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
                        });
                        
                        return {
                            totalUsers, 
                            newUsers24h, 
                            dbLatency,
                            currentMem: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
                            cpu: (os.loadavg()[0] * 10).toFixed(1)
                        };
                    } catch (err) {
                        return { error: 'Data Fetch Error' };
                    }
                },
            },
            branding: { 
                companyName: 'Neural Pulse Hub', 
                logo: false, 
                softwareBrothers: false,
                theme: {
                    colors: {
                        primary100: '#00f2fe',
                        bg: '#05070a',        
                        border: '#1a1f29',    
                        text: '#ffffff',      
                        container: '#0d1117', 
                        filterBg: '#0d1117',  
                        inputBorder: '#2d333f'
                    }
                }
            }
        };

        const adminJs = new AdminJS(adminOptions);

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') {
                    return { email: 'admin@neuralpulse.tech' };
                }
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
            logger.system("AdminJS interface: ONLINE (Cyber Dashboard) on port 3001");
        });

    } catch (e) { 
        logger.error("Admin Boot Failure", e); 
    }
};

startAdmin();
