import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dayjs from 'dayjs';
import EventEmitter from 'events'; 
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';

// --- 🏛️ ADMINJS IMPORTS ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { ComponentLoader } from 'adminjs';

// Ядро данных
import { sequelize, User, Task, Stats, GlobalStats, sessionStore, initDB, Op } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Регистрация адаптера
AdminJS.registerAdapter(AdminJSSequelize);
const componentLoader = new ComponentLoader();

// --- 💠 СИНГУЛЯРНОСТЬ ВЫСШЕГО ПОРЯДКА ---
class GodCore extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(0);
    }
}
const core = new GodCore();

const neuralLog = (msg, type = 'INFO') => {
    const time = dayjs().format('HH:mm:ss.SSS');
    const icons = { 
        INFO: '💎', WARN: '⚠️', ERROR: '☢️', CORE: '🔮', 
        NET: '🛰️', SUCCESS: '🔋', ANTI_CHEAT: '⚔️', SYNC: '🧬', SHIELD: '🛡️', VOID: '⬛'
    };
    console.log(`${icons[type] || '▪️'} [${time}] ${msg}`);
};

// --- ⚙️ OMNI-CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN || "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const SECRET_SALT = process.env.SECRET_SALT || "ULTRA_SECRET_PULSE_2026_VOID";
const DASHBOARD_COMPONENT = path.join(__dirname, 'static', 'dashboard.jsx');

const bot = new Telegraf(BOT_TOKEN);

// --- 🛡️ PROTOCOL "VOID AEGIS" ---
const shieldData = new Map(); 
const blackList = new Set(); 
const updateBuffer = new Map();
let isSyncing = false;
let isCircuitOpen = false;

// --- 🧬 DELTA-SYNC ENGINE ---
const executeMassiveCommit = async () => {
    if (updateBuffer.size === 0 || isSyncing) return;
    isSyncing = true;
    const snapshot = Array.from(updateBuffer.values());
    updateBuffer.clear();
    const CHUNK_SIZE = 2500;

    for (let i = 0; i < snapshot.length; i += CHUNK_SIZE) {
        const chunk = snapshot.slice(i, i + CHUNK_SIZE);
        try {
            const ids = chunk.map(u => u.id);
            const cases = chunk.map(u => `WHEN id = ${u.id} THEN ${u.balance}`).join(' ');
            await sequelize.query(
                `UPDATE users SET balance = CASE ${cases} ELSE balance END, 
                updated_at = NOW() WHERE id IN (${ids.join(',')})`
            );
        } catch (e) {
            neuralLog(`🚨 SYNC ERROR: ${e.message}`, 'ERROR');
            isCircuitOpen = true;
        }
    }
    isSyncing = false;
};
setInterval(executeMassiveCommit, 3000);

// --- 🌐 API & ADMIN SETUP ---
async function setupSupremeInterface(app) {
    // 1. Настройка AdminJS (TITAN UI DESIGN)
    const adminJs = new AdminJS({
        resources: [
            { 
                resource: User, 
                options: { 
                    navigation: { name: 'DATABASE', icon: 'User' },
                    listProperties: ['id', 'username', 'balance', 'wallet', 'updatedAt']
                } 
            },
            { resource: Task, options: { navigation: { name: 'QUESTS', icon: 'List' } } },
            { resource: Stats, options: { navigation: { name: 'ANALYTICS', icon: 'Activity' } } },
            { resource: GlobalStats, options: { navigation: { name: 'SYSTEM', icon: 'Settings' } } }
        ],
        rootPath: '/admin',
        componentLoader,
        dashboard: { 
            component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
            handler: async () => {
                const [gs, topUsers] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.findAll({ limit: 5, order: [['balance', 'DESC']] })
                ]);
                return { 
                    totalUsers: gs?.total_users || 0, 
                    totalBalance: gs?.total_balance || 0,
                    topUsers: topUsers
                };
            }
        },
        branding: {
            companyName: 'NEURAL PULSE OS',
            logo: `${DOMAIN}/static/images/logo.png`,
            withMadeWithLove: false,
            theme: {
                colors: {
                    primary100: '#00f2fe',
                    bg: '#0b0e11',
                    container: '#15191d',
                    text: '#ffffff'
                }
            }
        }
    });

    // Авторизация: Логин 1, Пароль 1
    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate: async (email, password) => (email === '1' && password === '1' ? { email } : null),
        cookiePassword: 'np-ultra-crypt-v12',
    }, null, { 
        resave: false, 
        saveUninitialized: false, 
        secret: 'np_secret_key', 
        store: sessionStore 
    });

    app.use(adminJs.options.rootPath, adminRouter);
    await adminJs.initialize();

    // 2. API Роуты
    app.get('/health', (req, res) => {
        res.status(isCircuitOpen ? 503 : 200).json({ status: isCircuitOpen ? 'degraded' : 'perfect' });
    });

    app.post('/api/save', (req, res) => {
        const { id, balance, hash } = req.body;
        if (blackList.has(id)) return res.status(403).send("VOID");
        const check = crypto.createHmac('sha256', SECRET_SALT).update(`${id}:${balance}`).digest('hex');
        if (hash !== check) return res.status(403).send("SIGN_ERR");
        updateBuffer.set(id, { id, balance });
        res.json({ s: 1, node: "QUANTUM-X" });
    });

    app.get('/api/admin/stream', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const listener = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        core.on('broadcast', listener);
        req.on('close', () => core.removeListener('broadcast', listener));
    });
}

// --- 🤖 BOT SETUP ---
function setupBot(botInstance) {
    botInstance.start(async (ctx) => {
        try {
            const [user, created] = await User.findOrCreate({
                where: { id: ctx.from.id },
                defaults: { username: ctx.from.username || `AGENT_${ctx.from.id}`, balance: 0 }
            });
            if (created) await GlobalStats.increment('total_users', { where: { id: 1 } });

            ctx.replyWithHTML(
                `<b>─── [ NEURAL OS : OMNI ] ───</b>\n\n` +
                `Agent: <code>${user.username}</code>\n` +
                `Status: <b>V12 QUANTUM</b>\n\n` +
                `<i>Система готова к синхронизации.</i>`,
                Markup.inlineKeyboard([
                    [Markup.button.webApp("⚡ ТЕРМИНАЛ", `${DOMAIN}/static/index.html`)],
                    [Markup.button.url("🛰️ ТРАНСЛЯЦИЯ", "https://t.me/neural_pulse_news")]
                ])
            );
        } catch (e) { neuralLog(`Bot Error: ${e.message}`, 'ERROR'); }
    });
}

// --- 🚀 SUPREME LAUNCH SEQUENCE ---
async function startSupreme() {
    neuralLog('🔮 INITIALIZING OMNI-QUANTUM CORE...', 'CORE');
    const app = express();

    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(compression({ level: 1 }));
    app.use(cors());
    app.use(express.json({ limit: '5kb' }));

    app.use('/static', express.static(path.join(__dirname, 'static'), { maxAge: '30d' }));

    try {
        await initDB();
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });
        
        await setupSupremeInterface(app);
        setupBot(bot);

        setInterval(() => {
            core.emit('broadcast', {
                v: '12.0-OMNI',
                users: updateBuffer.size,
                ram: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)}MB`,
                load: os.loadavg()[0].toFixed(2)
            });
        }, 2000);

        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => bot.handleUpdate(req.body, res));
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);

        app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`👑 OMNI-QUANTUM ONLINE | PORT: ${PORT}`, 'SUCCESS');
            neuralLog(`🚀 ADMIN PORTAL: ${DOMAIN}/admin (Login: 1 / Pass: 1)`, 'SUCCESS');
        });
    } catch (err) {
        neuralLog(`🚨 SYSTEM FAIL: ${err.message}`, 'ERROR');
        process.exit(1);
    }
}

startSupreme();
