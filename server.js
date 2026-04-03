import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import EventEmitter from 'events'; 
import os from 'os';
import pino from 'pino';

// --- 🏛️ ADMINJS & CORE IMPORTS ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { ComponentLoader } from 'adminjs';

// Ядро данных (модели из db.js)
import { sequelize, User, Task, GlobalStats, sessionStore, initDB, Op } from './db.js';

const logger = pino({ transport: { target: 'pino-pretty' } });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSSequelize);
const componentLoader = new ComponentLoader();

// --- 💠 GOD_CORE: REAL-TIME EVENT HUB ---
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
            const loadRaw = os.loadavg()?.[0] || 0;
            const rssMb = parseFloat((memory.rss / 1024 / 1024).toFixed(1));

            return {
                event_type: 'SYSTEM_PULSE',
                core_load: parseFloat(((loadRaw / (cpus.length || 1)) * 100).toFixed(1)),
                sync_memory: rssMb, 
                active_agents: this.cache.gs?.total_users || 0,
                network_latency: Math.floor(Math.random() * 15 + 5), 
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
const DASHBOARD_COMPONENT = path.join(__dirname, 'static', 'dashboard.jsx');

const bot = new Telegraf(BOT_TOKEN);

// --- 🧬 DELTA-SYNC ENGINE (BATCH UPDATES) ---
const updateBuffer = new Map();
let isSyncing = false;

const executeMassiveCommit = async () => {
    if (updateBuffer.size === 0 || isSyncing) return;
    isSyncing = true;
    
    const snapshot = Array.from(updateBuffer.entries());
    updateBuffer.clear();
    
    try {
        await sequelize.transaction(async (t) => {
            await Promise.all(snapshot.map(([id, data]) => 
                User.update(
                    { balance: data.balance, wallet: data.wallet, last_seen: new Date() }, 
                    { where: { id: id }, transaction: t }
                )
            ));
        });
        neuralLog(`Delta-Sync: ${snapshot.length} records committed.`, 'SUCCESS');
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

// --- 🌐 INTERFACE & STREAM SETUP ---
async function setupSupremeInterface(app) {
    const adminJs = new AdminJS({
        resources: [
            { resource: User, options: { navigation: { name: 'DATABASE', icon: 'User' } } },
            { resource: Task, options: { navigation: { name: 'CONTENT', icon: 'List' } } },
            { resource: GlobalStats, options: { navigation: { name: 'SYSTEM', icon: 'Settings' } } }
        ],
        rootPath: '/admin',
        componentLoader,
        dashboard: { 
            component: componentLoader.add('Dashboard', DASHBOARD_COMPONENT),
            handler: async () => {
                const [gs, top] = await Promise.all([
                    GlobalStats.findByPk(1),
                    User.findAll({ limit: 50, order: [['balance', 'DESC']] })
                ]);
                return { usersList: JSON.parse(JSON.stringify(top)), global: gs };
            }
        },
        branding: {
            companyName: 'NEURAL PULSE',
            logo: `${DOMAIN}/static/images/logo.png`,
            theme: { colors: { primary100: '#00f2fe', bg: '#0b0e11' } }
        }
    });

    app.post('/api/admin/system', express.json(), async (req, res) => {
        const { cmd, id, amount, msg } = req.body;
        try {
            if (cmd === 'SET_BALANCE') {
                await User.update({ balance: amount }, { where: { id: id } });
                updateBuffer.delete(id.toString());
                neuralLog(`[DASHBOARD] Manual balance sync for ${id}: ${amount}`, 'WARN');
                return res.json({ success: true });
            }
            if (cmd === 'RESTART') {
                neuralLog('[DASHBOARD] Core reboot initiated...', 'ERROR');
                res.json({ success: true });
                await executeMassiveCommit();
                setTimeout(() => process.exit(0), 1000);
                return;
            }
            if (cmd === 'CLEAR_CACHE') {
                updateBuffer.clear();
                neuralLog('[DASHBOARD] Memory buffer purged', 'SUCCESS');
                return res.json({ success: true });
            }
            if (cmd === 'BROADCAST') {
                const users = await User.findAll({ attributes: ['id'] });
                neuralLog(`[DASHBOARD] Global broadcast to ${users.length} agents`, 'CORE');
                for (const user of users) {
                    bot.telegram.sendMessage(user.id, `📡 <b>SYSTEM NOTIFICATION</b>\n\n${msg}`, { parse_mode: 'HTML' }).catch(() => {});
                }
                return res.json({ success: true });
            }
            res.status(400).json({ error: 'UNKNOWN_COMMAND' });
        } catch (err) {
            res.status(500).json({ error: err.message });
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

    app.get('/api/admin/stream', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });

        const sendPulse = (data) => {
            if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        core.on('broadcast', sendPulse);
        
        const keepAlive = setInterval(() => {
            if (!res.writableEnded) res.write(': keep-alive\n\n');
        }, 15000);

        req.on('close', () => {
            clearInterval(keepAlive);
            core.removeListener('broadcast', sendPulse);
            res.end();
        });
    });

    app.post('/api/save', async (req, res) => {
        const { id, balance, wallet } = req.body;
        if (!id) return res.status(400).send("ID_REQUIRED");
        
        updateBuffer.set(id.toString(), { 
            balance: balance,
            wallet: wallet || null
        });
        res.json({ success: true, timestamp: Date.now() });
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
                neuralLog(`New Agent Protocol: ${user.username}`, 'SUCCESS');
            }

            ctx.replyWithHTML(
                `<b>── [ NEURAL OS : APEX ] ──</b>\n\n` +
                `Agent: <code>${user.username}</code>\n` +
                `Node: <b>NL-Amsterdam-4</b>\n` +
                `Status: <b>AUTHORIZED</b>`,
                Markup.inlineKeyboard([
                    [Markup.button.webApp("⚡ ТЕРМИНАЛ", `${DOMAIN}/static/index.html`)]
                ])
            );
        } catch (e) { neuralLog(`Bot Error: ${e.message}`, 'ERROR'); }
    });
}

// --- 🚀 STARTUP ---
async function startSupreme() {
    neuralLog('🔮 BOOTING NEURAL PULSE ENGINE...', 'CORE');
    const app = express();

    app.use(helmet({ contentSecurityPolicy: false }));
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
        app.post(webhookPath, (req, res) => bot.handleUpdate(req.body, res));
        await bot.telegram.setWebhook(`${DOMAIN}${webhookPath}`);

        const server = app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`👑 SYSTEM ONLINE | PORT: ${PORT}`, 'SUCCESS');
        });

        const shutdown = async () => {
            neuralLog('☢️ EMERGENCY SHUTDOWN...', 'WARN');
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
