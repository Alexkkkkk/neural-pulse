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
// Файл dashboard.jsx должен находиться в папке static
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
                withMadeWithLove: false,
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
                    /* Глобальное переопределение фона */
                    body, #adminjs, section[data-testid="sidebar"], .adminjs_Sidebar { 
                        background: #05070a !important; 
                    }
                    
                    /* Стилизация страницы входа */
                    [data-testid="login"] { 
                        background: radial-gradient(circle, #0d1117 0%, #05070a 100%) !important; 
                    }
                    [data-testid="login"] > div:first-child { 
                        background: #0a0a0a !important; 
                        border-right: 2px solid #00f2fe !important; 
                        box-shadow: 10px 0 30px rgba(0, 242, 254, 0.1) !important;
                    }
