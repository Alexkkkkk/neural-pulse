import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes, Op } from 'sequelize';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

// AdminJS (v7+)
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
AdminJS.registerAdapter(AdminJSSequelize);

// --- СУПЕР-ЛОГГЕР ---
const logger = {
    info: (msg, meta = '') => console.log(`[${new Date().toLocaleString()}] 🔵 INFO: ${msg}`, meta),
    system: (msg) => console.log(`[${new Date().toLocaleString()}] 🚀 SYSTEM: ${msg}`),
    warn: (msg, meta = '') => console.log(`[${new Date().toLocaleString()}] 🟡 WARN: ${msg}`, meta),
    error: (msg, err) => {
        console.error(`[${new Date().toLocaleString()}] 🔴 ERROR: ${msg}`);
        if (err) console.error("--- Stack Trace Start ---\n", err, "\n--- Stack Trace End ---");
    },
    ai: (userId, response, tokens) => {
        console.log(`[${new Date().toLocaleString()}] 🤖 AI_LOG: User: ${userId} | Tokens: ${tokens}`);
    },
    http: (req, res, next) => {
        const requestId = uuidv4().split('-')[0];
        const start = Date.now();
        if (req.url.startsWith('/api')) {
            logger.info(`REQ [${requestId}] ${req.method} ${req.url}`);
        }
        res.on('finish', () => {
            if (req.url.startsWith('/api')) {
                const duration = Date.now() - start;
                const statusColor = res.statusCode >= 400 ? '🔴' : '🟢';
                console.log(`[${new Date().toLocaleString()}] ${statusColor} RES [${requestId}] ${res.statusCode} | ${duration}ms`);
            }
        });
        next();
    }
};

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;
const OPENAI_KEY = "твой_ключ_здесь"; // Вставь свой ключ OpenAI

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Глобальный перехват ошибок
process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection', reason));
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err);
    setTimeout(() => process.exit(1), 1000);
});

// --- MIDDLEWARES ---
app.disable('x-powered-by'); 
app.set('trust proxy', 1);
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(logger.http); 

app.use(express.static(path.join(__dirname, 'static'), { 
    maxAge: '30d', 
    immutable: true
}));

// --- БАЗА ДАННЫХ ---
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false,
    dialectOptions: { ssl: false },
    pool: { max: 30, min: 5 }
});

// --- MODELS ---
const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    username: { type: DataTypes.STRING },
    photo_url: { type: DataTypes.TEXT },
    balance: { type: DataTypes.DOUBLE, defaultValue: 0 },
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    profit: { type: DataTypes.DOUBLE, defaultValue: 0 }, 
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
    referred_by: { type: DataTypes.BIGINT, allowNull: true },
    completed_tasks: { type: DataTypes.JSONB, defaultValue: [] }, // Храним ID выполненных заданий
    wallet: { type: DataTypes.STRING, allowNull: true }, // Адрес TON кошелька
    last_bonus: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false });

const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, unique: true },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING }
}, { timestamps: false });

const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_count: { type: DataTypes.INTEGER },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    timestamp: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false });

const calculateLevel = (b) => b < 10000 ? 1 : b < 100000 ? 2 : b < 500000 ? 3 : b < 2000000 ? 4 : 5;

// --- API GAME CORE ---
app.get('/api/user/:id', async (req, res) => {
    try {
        const userId = BigInt(req.params.id);
        const user = await User.findByPk(userId);
        
        if (!user) {
            const newUser = await User.create({ 
                id: userId, 
                username: req.query.username || 'AGENT'
            });
            return res.json(newUser);
        }
        
        const now = new Date();
        const offline = Math.floor((now - new Date(user.last_seen)) / 1000);
        
        if (offline > 60 && user.profit > 0) {
            const earned = (user.profit / 3600) * Math.min(offline, 86400);
            user.balance += parseFloat(earned.toFixed(2));
            user.last_seen = now;
            user.level = calculateLevel(user.balance);
            await user.save();
            logger.info(`Sync: User ${userId} | Profit: +${earned.toFixed(2)}`);
        }
        res.json(user);
    } catch (e) { 
        logger.error(`API Sync Error`, e);
        res.status(500).json({ error: "INTERNAL_CORE_FAULT" }); 
    }
});

app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        if (!id) return res.status(400).json({ error: "ID_REQUIRED" });
        const userId = BigInt(id);
        if (data.balance !== undefined) data.level = calculateLevel(data.balance);
        
        await User.update({ ...data, last_seen: new Date() }, { where: { id: userId } });
        res.json({ ok: true });
    } catch (e) {
        logger.error(`Save Failed`, e);
        res.status(500).json({ error: "STORAGE_FAULT" });
    }
});

// --- AI ADVISOR ENDPOINT ---
app.post('/api/ai-advice', async (req, res) => {
    try {
        const { id, balance, levels } = req.body;
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "Ты - ИИ терминала Neural Pulse. Говори кратко, технично, в стиле киберпанка. Давай советы по прокачке." },
                { role: "user", content: `Баланс: ${balance} NP. Уровни: Tap ${levels.tap}, Mine ${levels.mine}. Что проапгрейдить?` }
            ],
            max_tokens: 80
        });

        const advice = completion.choices[0].message.content;
        logger.ai(id, advice, completion.usage.total_tokens);
        res.json({ text: advice });
    } catch (e) {
        logger.error("AI Error", e);
        res.json({ text: "System link unstable. Re-routing data..." });
    }
});

// --- PAYMENT CONFIRMATION ---
app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { id, txHash, amount } = req.body;
        // В реальном проекте тут идет проверка через TonCenter API
        const user = await User.findByPk(BigInt(id));
        if (user) {
            user.balance += 1000000; // Начисляем 1М за покупку
            await user.save();
            logger.info(`PAYMENT: User ${id} | TX: ${txHash} | +1,000,000 NP`);
            res.json({ ok: true });
        }
    } catch (e) {
        res.status(500).json({ error: "PAYMENT_FAULT" });
    }
});

// --- АДМИНКА ---
const startAdmin = async () => {
    try {
        const { default: connectSessionSequelize } = await import('connect-session-sequelize');
        const SequelizeStore = connectSessionSequelize(session.Store);
        const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
        
        const adminJs = new AdminJS({
            resources: [{ resource: User }, { resource: Task }, { resource: Stats }],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse Hub', logo: false },
            bundler: { enabled: false }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
            cookiePassword: 'secure-pass-2026-pulse',
        }, null, {
            store: sessionStore, 
            secret: 'neural_pulse_secret_2026', 
            resave: false, 
            saveUninitialized: false,
            proxy: true,
            cookie: { maxAge: 86400000, secure: false }
        });
        
        app.use(adminJs.options.rootPath, adminRouter);
    } catch (e) { logger.error("Admin Boot Failure", e); }
};

// --- TELEGRAM BOT ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refIdRaw = ctx.startPayload;
    const logoPath = path.join(__dirname, 'static/images/logo.png');

    try {
        let user = await User.findByPk(userId);
        if (!user) {
            let startBal = 0, refBy = null;
            if (refIdRaw && BigInt(refIdRaw) !== BigInt(userId)) {
                refBy = BigInt(refIdRaw); 
                startBal = 5000;
                await User.increment({ balance: 10000, referrals: 1 }, { where: { id: refBy } });
            }
            user = await User.create({ 
                id: userId, 
                username: ctx.from.username || ctx.from.first_name || 'AGENT', 
                balance: startBal, 
                referred_by: refBy 
            });
        }
        
        ctx.replyWithPhoto({ source: logoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nИдентификация пройдена.\nАгент: <code>${ctx.from.username || userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]])
        });
    } catch (e) { logger.error(`Bot Error`, e); }
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- ENGINE START ---
const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
        logger.system('--- NEURAL PULSE ENGINE STARTING ---');
        await sequelize.authenticate();
        await sequelize.sync({ alter: true }); 
        await startAdmin(); 
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        logger.system(`ENGINE: READY (Port ${PORT})`);
    } catch (err) { logger.error("CRITICAL ENGINE BOOTSTRAP FAILURE", err); }
});

process.on('SIGTERM', () => server.close(async () => { 
    await sequelize.close(); 
    process.exit(0); 
}));
