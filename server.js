import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import EventEmitter from 'events'; 
import os from 'os';
import crypto from 'crypto';
import pino from 'pino';

// --- 🏛️ ADMINJS & CORE IMPORTS ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { ComponentLoader } from 'adminjs';

// Ядро данных
import { sequelize, User, Task, Stats, GlobalStats, sessionStore, initDB } from './db.js';

const logger = pino({ transport: { target: 'pino-pretty' } });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSSequelize);
const componentLoader = new ComponentLoader();

// --- 💠 GOD_CORE: EVENT HUB ---
class GodCore extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(0);
    }
    
    async generatePulse() {
        try {
            const memory = process.memoryUsage();
            // Безопасное получение статы через опциональную цепочку
            const gs = await GlobalStats.findByPk(1);
            
            return {
                event_type: 'SYSTEM',
                core_load: parseFloat((os.loadavg()[0] * 10).toFixed(1)),
                sync_memory: parseFloat(((memory.rss / os.totalmem()) * 100).toFixed(1)),
                active_agents: gs?.total_users || 0,
                network_latency: Math.floor(Math.random() * 20 + 10),
                pulse_liquidity: gs?.total_balance || 0,
                timestamp: new Date().toISOString()
            };
        } catch (err) {
            logger.error({ err }, 'Pulse generation failed');
            return null;
        }
    }
}
const core = new GodCore();

const neuralLog = (msg, type = 'INFO') => {
    const icons = { INFO: '💎', WARN: '⚠️', ERROR: '☢️', SUCCESS: '🔋', CORE: '🔮' };
    logger.info(`${icons[type] || '▪️'} ${msg}`);
};

// --- ⚙️ CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN || "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const SECRET_SALT = process.env.SECRET_SALT || "ULTRA_SECRET_PULSE_2026_VOID";
const DASHBOARD_COMPONENT = path.join(__dirname, 'static', 'dashboard.jsx');

const bot = new Telegraf(BOT_TOKEN);

// --- 🧬 DELTA-SYNC ENGINE ---
const updateBuffer = new Map();
let isSyncing = false;

const executeMassiveCommit = async () => {
    if (updateBuffer.size === 0 || isSyncing) return;
    isSyncing = true;
    
    // Копируем буфер и очищаем оригинал сразу, чтобы не потерять входящие данные
    const snapshot = Array.from(updateBuffer.entries());
    updateBuffer.clear();
    
    try {
        await sequelize.transaction(async (t) => {
            for (const [id, data] of snapshot) {
                // Используем прямое обновление баланса, чтобы избежать конфликтов
                await User.update(
                    { balance: data.balance }, 
                    { where: { id }, transaction: t }
                );
            }
        });
        neuralLog(`Delta-Sync: ${snapshot.length} units committed.`, 'SUCCESS');
    } catch (e) {
        neuralLog(`🚨 SYNC ERROR: ${e.message}`, 'ERROR');
        // В случае ошибки можно вернуть данные в буфер (опционально)
    } finally {
        isSyncing = false;
    }
};
setInterval(executeMassiveCommit, 5000);

// --- 🌐 INTERFACE & REAL-TIME STREAM ---
async function setupSupremeInterface(app) {
    const adminJs = new AdminJS({
        resources: [
            { resource: User, options: { navigation: { name: 'DATABASE', icon: 'User' } } },
            { resource: Task, options: { navigation: { name: 'CONTENT', icon: 'List' } } },
            { resource: Stats, options: { navigation: { name: 'ANALYTICS', icon: 'Activity' } } },
            { resource: GlobalStats, options: { navigation: { name: 'SYSTEM', icon: 'Settings' } } }
        ],
        rootPath: '/admin',
        componentLoader,
        dashboard: { 
            component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
            handler: async () => {
                const [gs, top] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.findAll({ limit: 10, order: [['balance', 'DESC']] })
                ]);
                return { usersList: top, global: gs };
            }
        },
        branding: {
            companyName: 'NEURAL PULSE',
            logo: `${DOMAIN}/static/images/logo.png`,
            theme: { colors: { primary100: '#00f2fe', bg: '#0b0e11' } }
        }
    });

    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate: async (email, password) => (email === '1' && password === '1' ? { email } : null),
        cookiePassword: 'np-ultra-secure-key-2026',
    }, null, { 
        resave: false, 
        saveUninitialized: false, 
        secret: 'pulse_secret', 
        store: sessionStore 
    });

    app.use(adminJs.options.rootPath, adminRouter);
    await adminJs.initialize();

    // SSE STREAM
    app.get('/api/admin/stream', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); 
        res.flushHeaders();

        const sendData = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        core.on('broadcast', sendData);

        const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 15000);

        req.on('close', () => {
            clearInterval(keepAlive);
            core.removeListener('broadcast', sendData);
            res.end();
        });
    });

    app.post('/api/save', (req, res) => {
        const { id, balance, hash } = req.body;
        const check = crypto.createHmac('sha256', SECRET_SALT).update(`${id}:${balance}`).digest('hex');
        if (hash !== check) return res.status(403).send("SIGN_ERR");
        
        updateBuffer.set(id, { balance });
        res.json({ s: 1 });
    });
}

// --- 🤖 BOT LOGIC ---
function setupBot(botInstance) {
    botInstance.start(async (ctx) => {
        try {
            const [user, created] = await User.findOrCreate({
                where: { id: ctx.from.id.toString() }, // ID в БД часто строка
                defaults: { username: ctx.from.username || `AGENT_${ctx.from.id}`, balance: 0 }
            });
            
            if (created) {
                await GlobalStats.increment('total_users', { where: { id: 1 } });
            }

            ctx.replyWithHTML(
                `<b>── [ NEURAL OS : OMNI ] ──</b>\n\nAgent: <code>${user.username}</code>\nSystem: <b>V12.7 Stable</b>\nStatus: <b>ONLINE</b>`,
                Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ", `${DOMAIN}/static/index.html`)]])
            );
        } catch (e) {
            neuralLog(`Bot Start Error: ${e.message}`, 'ERROR');
        }
    });
}

// --- 🚀 STARTUP ---
async function startSupreme() {
    neuralLog('🔮 BOOTING NEURAL PULSE...', 'CORE');
    const app = express();

    app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
    app.use(compression());
    app.use(cors());
    app.use(express.json());
    app.use('/static', express.static(path.join(__dirname, 'static')));

    try {
        await initDB();
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });
        
        await setupSupremeInterface(app);
        setupBot(bot);

        // Пульсация
        setInterval(async () => {
            const pulse = await core.generatePulse();
            if (pulse) core.emit('broadcast', pulse);
        }, 3000);

        // Webhook
        const webhookPath = `/telegraf/${BOT_TOKEN}`;
        app.post(webhookPath, (req, res) => bot.handleUpdate(req.body, res));
        await bot.telegram.setWebhook(`${DOMAIN}${webhookPath}`);

        app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`👑 SYSTEM ONLINE | PORT: ${PORT}`, 'SUCCESS');
        });

    } catch (err) {
        neuralLog(`🚨 BOOT FAIL: ${err.message}`, 'ERROR');
    }
}

startSupreme();
