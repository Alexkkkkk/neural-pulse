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

// Ядро данных (убедитесь, что db.js экспортирует эти модели)
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
            
            if (!this.cache.gs || Date.now() - this.cache.lastUpdate > 5000) {
                this.cache.gs = await GlobalStats.findByPk(1);
                this.cache.lastUpdate = Date.now();
            }
            
            const cpus = os.cpus() || [];
            const cpuCount = cpus.length || 1;
            const loadRaw = os.loadavg()?.[0] || 0;

            // ИСПРАВЛЕНИЕ: Передаем реальные МБ для SYNC_MEMORY, чтобы избежать 0.0%
            const rssMb = parseFloat((memory.rss / 1024 / 1024).toFixed(1));

            return {
                event_type: 'SYSTEM',
                core_load: parseFloat(((loadRaw / cpuCount) * 100).toFixed(1)),
                sync_memory: rssMb, // Теперь это мегабайты
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

// --- 🛡️ SECURITY UTILS ---
function verifyTelegramWebAppData(telegramInitData) {
    try {
        if (!telegramInitData) return false;
        const urlParams = new URLSearchParams(telegramInitData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckString = Array.from(urlParams.entries())
            .map(([key, value]) => `${key}=${value}`)
            .sort()
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(BOT_TOKEN)
            .digest();

        const hmac = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        return hmac === hash;
    } catch (e) {
        return false;
    }
}

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
                    { where: { id: id.toString() }, transaction: t }
                );
            }
        });
        neuralLog(`Delta-Sync: ${snapshot.length} units committed.`, 'SUCCESS');
    } catch (e) {
        neuralLog(`🚨 SYNC ERROR: ${e.message}`, 'ERROR');
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

    // SSE Stream
    app.get('/api/admin/stream', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });

        const sendData = (data) => {
            if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
        };

        core.on('broadcast', sendData);
        const keepAlive = setInterval(() => {
            if (!res.writableEnded) res.write(': keep-alive\n\n');
        }, 15000);

        req.on('close', () => {
            clearInterval(keepAlive);
            core.removeListener('broadcast', sendData);
            res.end();
        });
    });

    app.post('/api/save', async (req, res) => {
        const { id, balance, hash, initData } = req.body;
        if (!id || balance === undefined) return res.status(400).send("DATA_MISSING");

        try {
            const user = await User.findByPk(id.toString());
            if (!user) return res.status(404).send("USER_NOT_FOUND");

            const nonce = new Date(user.updatedAt).getTime();
            const check = crypto.createHmac('sha256', SECRET_SALT)
                .update(`${id}:${balance}:${nonce}`)
                .digest('hex');
            
            if (hash !== check) {
                if (initData && verifyTelegramWebAppData(initData)) {
                     updateBuffer.set(id.toString(), { balance });
                     return res.json({ s: 1, next_nonce: Date.now() });
                }
                return res.status(403).json({ error: "SIGN_ERR", required_nonce: nonce });
            }
            
            updateBuffer.set(id.toString(), { balance });
            res.json({ s: 1, next_nonce: Date.now() });
            
        } catch (err) {
            res.status(500).send("INTERNAL_ERROR");
        }
    });

    app.get('/api/user/:id', async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).send("NOT_FOUND");
            res.json({ balance: user.balance, nonce: new Date(user.updatedAt).getTime() });
        } catch (err) { res.status(500).send("ERR"); }
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
                neuralLog(`New Agent: ${user.username}`, 'SUCCESS');
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
        } catch (e) { neuralLog(`Bot Error: ${e.message}`, 'ERROR'); }
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

        setInterval(async () => {
            const pulse = await core.generatePulse();
            if (pulse) core.emit('broadcast', pulse);
        }, 3000);

        const webhookPath = `/telegraf/${BOT_TOKEN}`;
        
        // ИСПРАВЛЕНИЕ: Добавлен явный ответ для Webhook Telegram
        app.post(webhookPath, (req, res) => {
            bot.handleUpdate(req.body, res)
                .then(() => { if (!res.writableEnded) res.status(200).send('OK'); })
                .catch((err) => {
                    neuralLog(`Webhook Error: ${err.message}`, 'ERROR');
                    if (!res.writableEnded) res.sendStatus(500);
                });
        });

        await bot.telegram.setWebhook(`${DOMAIN}${webhookPath}`);

        const server = app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`👑 SYSTEM ONLINE | PORT: ${PORT}`, 'SUCCESS');
        });

        const shutdown = async () => {
            neuralLog('☢️ SHUTTING DOWN...', 'WARN');
            await executeMassiveCommit();
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

startSupreme();
