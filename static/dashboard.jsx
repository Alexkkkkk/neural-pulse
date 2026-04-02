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

// Ядро данных (модели и инициализация)
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
    
    // Генерация живых метрик для графиков
    async generatePulse() {
        try {
            const memory = process.memoryUsage();
            // Получаем статистику из БД (или создаем временную, если БД еще занята)
            const gs = await GlobalStats.findByPk(1) || { total_users: 0, total_balance: 0 };
            
            return {
                event_type: 'SYSTEM',
                core_load: parseFloat((os.loadavg()[0] * 10).toFixed(1)), // Нагрузка CPU
                sync_memory: parseFloat(((memory.rss / os.totalmem()) * 100).toFixed(1)), // RAM %
                active_agents: gs.total_users,
                network_latency: Math.floor(Math.random() * 15 + 5),
                pulse_liquidity: gs.total_balance,
                timestamp: new Date().toISOString()
            };
        } catch (err) {
            logger.error('Pulse generation failed: ' + err.message);
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

// Пакетное обновление балансов раз в 5 секунд для экономии ресурсов БД
const executeMassiveCommit = async () => {
    if (updateBuffer.size === 0 || isSyncing) return;
    isSyncing = true;
    const snapshot = Array.from(updateBuffer.values());
    updateBuffer.clear();
    
    try {
        await sequelize.transaction(async (t) => {
            for (const u of snapshot) {
                await User.update({ balance: u.balance }, { where: { id: u.id }, transaction: t });
            }
        });
        neuralLog(`Delta-Sync: ${snapshot.length} users updated.`, 'SUCCESS');
    } catch (e) {
        neuralLog(`🚨 SYNC ERROR: ${e.message}`, 'ERROR');
    }
    isSyncing = false;
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
    }, null, { resave: false, saveUninitialized: false, secret: 'pulse_secret', store: sessionStore });

    app.use(adminJs.options.rootPath, adminRouter);
    await adminJs.initialize();

    // --- SSE STREAM: Реальное время для графиков ---
    app.get('/api/admin/stream', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Важно для Bothost/Nginx
        res.flushHeaders();

        const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 15000);

        const sendData = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        core.on('broadcast', sendData);

        req.on('close', () => {
            clearInterval(keepAlive);
            core.removeListener('broadcast', sendData);
            res.end();
        });
    });

    // API для сохранения игрового баланса из Mini App
    app.post('/api/save', (req, res) => {
        const { id, balance, hash } = req.body;
        const check = crypto.createHmac('sha256', SECRET_SALT).update(`${id}:${balance}`).digest('hex');
        if (hash !== check) return res.status(403).send("SIGN_ERR");
        
        updateBuffer.set(id, { id, balance });
        res.json({ s: 1 });
    });
}

// --- 🤖 BOT LOGIC ---
function setupBot(botInstance) {
    botInstance.start(async (ctx) => {
        const [user, created] = await User.findOrCreate({
            where: { id: ctx.from.id },
            defaults: { username: ctx.from.username || `AGENT_${ctx.from.id}`, balance: 0 }
        });
        if (created) await GlobalStats.increment('total_users', { where: { id: 1 } });

        ctx.replyWithHTML(
            `<b>── [ NEURAL OS : OMNI ] ──</b>\n\nAgent: <code>${user.username}</code>\nSystem: <b>V12.8 Live</b>\nStatus: <b>OPERATIONAL</b>`,
            Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ", `${DOMAIN}/static/index.html`)]])
        );
    });
}

// --- 🚀 STARTUP ---
async function startSupreme() {
    neuralLog('🔮 BOOTING NEURAL PULSE SYSTEM...', 'CORE');
    const app = express();

    app.use(helmet({ 
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false 
    }));
    app.use(compression());
    app.use(cors());
    app.use(express.json());
    
    app.use('/static', express.static(path.join(__dirname, 'static')));

    try {
        // Инициализация базы данных
        await initDB();
        await GlobalStats.findOrCreate({ 
            where: { id: 1 }, 
            defaults: { total_users: 0, total_balance: 0 } 
        });
        
        await setupSupremeInterface(app);
        setupBot(bot);

        // Интервал генерации "Пульса" данных
        setInterval(async () => {
            const pulse = await core.generatePulse();
            if (pulse) core.emit('broadcast', pulse);
        }, 3000);

        // Webhook для связи с Telegram
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => bot.handleUpdate(req.body, res));
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);

        const server = app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`👑 SYSTEM ONLINE | NODE: ${os.hostname()} | PORT: ${PORT}`, 'SUCCESS');
        });

        // Безопасное завершение
        process.on('SIGTERM', () => {
            server.close(() => neuralLog('Pulse sequence stopped.', 'WARN'));
        });

    } catch (err) {
        neuralLog(`🚨 BOOT FAIL: ${err.message}`, 'ERROR');
        process.exit(1);
    }
}

startSupreme();
