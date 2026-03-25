import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Op } from 'sequelize';
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
const dashboardPath = path.join(__dirname, 'static/dashboard.jsx');
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', dashboardPath);

const app = express();

const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Агенты', icon: 'User' } } }, 
                { resource: Task, options: { navigation: { name: 'Миссии', icon: 'Task' } } }, 
                { resource: Stats, options: { navigation: { name: 'Система', icon: 'Settings' } } }
            ],
            rootPath: '/admin',
            componentLoader,
            branding: { 
                companyName: 'Neural Pulse Hub', 
                logo: false, 
                softwareBrothers: false,
                theme: { colors: { primary100: '#00f2fe' } }
            },
            dashboard: {
                handler: async () => {
                    const startDb = Date.now();
                    await sequelize.query('SELECT 1');
                    const dbLatency = Date.now() - startDb;

                    const totalUsers = await User.count();
                    const newUsers24h = await User.count({
                        where: { createdAt: { [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
                    });

                    return {
                        totalUsers, newUsers24h, dbLatency,
                        currentMem: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
                        cpu: (os.loadavg()[0] * 10).toFixed(1)
                    };
                },
                component: DASHBOARD_COMPONENT,
            }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse',
        }, null, {
            resave: false, saveUninitialized: false, secret: 'neural_pulse_secret_2026',
            store: sessionStore,
            cookie: { maxAge: 86400000 }
        });
        
        app.use(adminJs.options.rootPath, adminRouter);
        
        app.listen(3001, '0.0.0.0', () => {
            logger.info("AdminJS interface: DEPLOYED on port 3001");
        });
    } catch (e) { logger.error("Admin Boot Failure", e); }
};

startAdmin();
