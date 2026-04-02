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

// Ядро данных (убедись, что db.js на месте)
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
        this.cache = { gs: null, lastUpdate: 0 };
    }
    
    async generatePulse() {
        try {
            const memory = process.memoryUsage();
            
            // Кеширование статистики на 5 сек для разгрузки БД
            if (!this.cache.gs || Date.now() - this.cache.lastUpdate > 5000) {
                this.cache.gs = await GlobalStats.findByPk(1);
                this.cache.lastUpdate = Date.now();
            }
            
            return {
                event_type: 'SYSTEM',
                core_load: parseFloat((os.loadavg()[0] * 10).toFixed(1)),
                sync_memory: parseFloat(((memory.rss / os.totalmem()) * 100).toFixed(1)),
                active_agents: this.cache.gs?.total_users || 0,
                network_latency: Math.floor(Math.random() * 20 + 10),
                pulse_liquidity: this.cache.gs?.total_balance || 0,
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
    
    const snapshot = Array.from(updateBuffer.entries());
    updateBuffer.clear();
    
    try {
        await sequelize.transaction(async (t) => {
            for (const [id, data] of snapshot) {
                await User.update(
                    { balance: data.balance }, 
                    { where: { id }, transaction: t }
                );
            }
        });
        neuralLog(`Delta-Sync: ${snapshot.length} units committed.`, 'SUCCESS');
    } catch (e) {
        neuralLog(`🚨 SYNC ERROR: ${e.message}`, 'ERROR');
        // Возврат данных в буфер при ошибке
        snapshot.forEach(([id, data]) => {
            if (!updateBuffer.has(id)) updateBuffer.set(id, data);
        });
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

    // SSE STREAM для админки
    app.get('/api/admin/stream', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); 
        res.flushHeaders();

        const sendData = (data) => {
            if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
        };

        core.on('broadcast', sendData);
        const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 15000);

        req.on('close', () => {
            clearInterval(keepAlive);
            core.removeListener('broadcast', sendData);
            res.end();
        });
    });

    // API для сохранения баланса из Mini App
    app.post('/api/save', (req, res) => {
        const { id, balance, hash } = req.body;
        if (!id || balance === undefined) return res.status(400).send("DATA_MISSING");

        const check = crypto.createHmac('sha256', SECRET_SALT).update(`${id}:${balance}`).digest('hex');
        if (hash !== check) return res.status(403).send("SIGN_ERR");
        
        updateBuffer.set(id.toString(), { balance });
        res.json({ s: 1 });
    });
}

// --- 🤖 BOT LOGIC ---
function setupBot(botInstance) {
    botInstance.start(async (ctx) => {
        try {
            const [user, created] = await User.findOrCreate({
                where: { id: ctx.from.id.toString() },
                defaults: { 
                    username: ctx.from.username || `AGENT_${ctx.from.id}`, 
                    balance: 0 
                }
            });
            
            if (created) {
                await GlobalStats.increment('total_users', { where: { id: 1 } });
            }

            ctx.replyWithHTML(
                `<b>── [ NEURAL OS : OMNI ] ──</b>\n\n` +
                `Agent: <code>${user.username}</code>\n` +
                `System: <b>V12.7 Stable</b>\n` +
                `Status: <b>ONLINE</b>`,
                Markup.inlineKeyboard([
                    [Markup.button.webApp("⚡ ТЕРМИНАЛ", `${DOMAIN}/static/index.html`)]
                ])
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
    
    // Статика
    app.use('/static', express.static(path.join(__dirname, 'static')));

    try {
        await initDB();
        await GlobalStats.findOrCreate({ 
            where: { id: 1 }, 
            defaults: { total_users: 0, total_balance: 0 } 
        });
        
        await setupSupremeInterface(app);
        setupBot(bot);

        // Пульс системы (SSE)
        setInterval(async () => {
            const pulse = await core.generatePulse();
            if (pulse) core.emit('broadcast', pulse);
        }, 3000);

        // Webhook
        const webhookPath = `/telegraf/${BOT_TOKEN}`;
        app.post(webhookPath, (req, res) => bot.handleUpdate(req.body, res));
        
        // Доп. маршрут для проверки в браузере (Cannot GET fix)
        app.get(webhookPath, (req, res) => res.send('System Pulse Active.'));
        
        await bot.telegram.setWebhook(`${DOMAIN}${webhookPath}`);

        const server = app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`👑 SYSTEM ONLINE | PORT: ${PORT}`, 'SUCCESS');
        });

        // Graceful Shutdown
        const shutdown = async () => {
            neuralLog('☢️ SHUTTING DOWN...', 'WARN');
            await executeMassiveCommit(); // Скидываем остатки буфера перед выходом
            server.close(async () => {
                await sequelize.close();
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (err) {
        neuralLog(`🚨 BOOT FAIL: ${err.message}`, 'ERROR');
        process.exit(1);
    }
}

process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled Rejection');
});

startSupreme();
