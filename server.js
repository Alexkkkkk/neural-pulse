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
import crypto from 'crypto'; // Для валидации данных
import 'dotenv/config';

// --- 🏛️ ADMINJS & CORE IMPORTS ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { ComponentLoader } from 'adminjs';

// Ядро данных
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
            logger.error('Pulse generation failed');
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
const BOT_TOKEN = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN || "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const DASHBOARD_COMPONENT = componentLoader.add('Dashboard', path.join(__dirname, 'static', 'dashboard.jsx'));

const bot = new Telegraf(BOT_TOKEN);

// --- 🛡️ SECURITY: TELEGRAM VALIDATOR ---
const validateInitData = (rawInitData) => {
    if (!rawInitData) return false;
    try {
        const urlParams = new URLSearchParams(rawInitData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        urlParams.sort();

        let dataCheckString = '';
        for (const [key, value] of urlParams.entries()) {
            dataCheckString += `${key}=${value}\n`;
        }
        dataCheckString = dataCheckString.slice(0, -1);

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        return calculatedHash === hash;
    } catch (e) { return false; }
};

// --- 🧬 DELTA-SYNC ENGINE (ULTRA OPTIMIZED) ---
const updateBuffer = new Map();
let isSyncing = false;

const executeMassiveCommit = async () => {
    if (updateBuffer.size === 0 || isSyncing) return;
    isSyncing = true;
    
    const snapshot = Array.from(updateBuffer.entries());
    updateBuffer.clear();
    
    try {
        // Преобразуем данные для массовой вставки/обновления (Upsert)
        const records = snapshot.map(([id, data]) => ({
            id: String(id),
            balance: data.balance,
            wallet: data.wallet,
            last_seen: new Date()
        }));

        await User.bulkCreate(records, {
            updateOnDuplicate: ['balance', 'wallet', 'last_seen']
        });

        neuralLog(`Delta-Sync: ${snapshot.length} records committed via Bulk Upsert.`, 'SUCCESS');
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
            component: DASHBOARD_COMPONENT,
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

    app.post('/api/admin/system', async (req, res) => {
        const { cmd, id, amount, msg } = req.body;
        try {
            if (cmd === 'SET_BALANCE') {
                await User.update({ balance: amount }, { where: { id: String(id) } });
                updateBuffer.delete(String(id));
                return res.json({ success: true });
            }
            if (cmd === 'RESTART') {
                res.json({ success: true });
                await executeMassiveCommit();
                setTimeout(() => process.exit(0), 1000);
                return;
            }
            if (cmd === 'BROADCAST') {
                const users = await User.findAll({ attributes: ['id'] });
                res.json({ success: true, count: users.length });
                
                // Безопасная рассылка с интервалом
                let i = 0;
                const interval = setInterval(() => {
                    if (i >= users.length) return clearInterval(interval);
                    bot.telegram.sendMessage(users[i].id, `📡 <b>SYSTEM NOTIFICATION</b>\n\n${msg}`, { parse_mode: 'HTML' }).catch(() => {});
                    i++;
                }, 40); // ~25 сообщений в сек, чтобы не получить бан от TG
                return;
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
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        const sendPulse = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        core.on('broadcast', sendPulse);
        req.on('close', () => core.removeListener('broadcast', sendPulse));
    });

    // --- 🚀 PROTECTED API ---
    app.post('/api/save', async (req, res) => {
        const { id, balance, wallet, _auth } = req.body;
        
        // Проверка подлинности запроса от Telegram
        if (!validateInitData(_auth)) {
            return res.status(403).json({ error: "UNAUTHORIZED_PROTOCOL" });
        }

        if (!id) return res.status(400).send("ID_REQUIRED");
        updateBuffer.set(String(id), { balance, wallet: wallet || null });
        res.json({ success: true });
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
            
            if (created) neuralLog(`New Agent Protocol: ${user.username}`, 'SUCCESS');

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
        await setupSupremeInterface(app); 
        setupBot(bot); 

        setInterval(async () => {
            const pulse = await core.generatePulse();
            if (pulse) core.emit('broadcast', pulse);
        }, 3000);

        const webhookPath = `/telegraf/${bot.token}`;
        app.use(bot.webhookCallback(webhookPath));
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
