import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes, Op } from 'sequelize';
import os from 'os';
import OpenAI from 'openai';

// AdminJS
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
AdminJS.registerAdapter(AdminJSSequelize);

// --- ЛОГИРОВАНИЕ ---
const logger = {
    info: (msg) => console.log(`[${new Date().toISOString()}] 🔵 INFO: ${msg}`),
    system: (msg) => console.log(`[${new Date().toISOString()}] 🚀 SYSTEM: ${msg}`),
    error: (msg, err) => console.error(`[${new Date().toISOString()}] 🔴 ERROR: ${msg}`, err || '')
};

// --- CONFIG ---
const OPENAI_API_KEY = "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";
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- УЛЬТРА ОПТИМИЗАЦИЯ СЕРВЕРА ---
app.disable('x-powered-by'); 
app.disable('etag'); 
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Мгновенная статика
app.use(express.static(path.join(__dirname, 'static'), { 
    maxAge: '30d', 
    immutable: true 
}));

// --- БАЗА ДАННЫХ (МАКСИМАЛЬНЫЙ ПУЛ) ---
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false, 
    dialectOptions: { ssl: false, connectTimeout: 10000 },
    pool: { max: 30, min: 5, acquire: 30000, idle: 10000 }
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
    profit: { type: DataTypes.INTEGER, defaultValue: 0 }, 
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
    referred_by: { type: DataTypes.BIGINT, allowNull: true },
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

// --- API ДЛЯ ИГРЫ (СВЕРХЗВУК) ---

app.get('/api/user/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, { raw: true });
        if (!user) return res.json(await User.create({ id: req.params.id, username: req.query.username || 'AGENT' }));
        
        const now = new Date();
        const offline = Math.floor((now - new Date(user.last_seen)) / 1000);
        if (offline > 60 && user.profit > 0) {
            const earned = (user.profit / 3600) * Math.min(offline, 86400);
            user.balance += parseFloat(earned.toFixed(2));
            user.last_seen = now;
            user.level = calculateLevel(user.balance);
            User.update(user, { where: { id: user.id } }).catch(()=>{});
        }
        res.json(user);
    } catch (e) { res.status(500).send("ERR"); }
});

app.post('/api/save', (req, res) => {
    res.status(202).json({ ok: true }); // Отвечаем сразу
    const { id, ...data } = req.body;
    if (id) {
        if (data.balance) data.level = calculateLevel(data.balance);
        User.update({ ...data, last_seen: new Date() }, { where: { id } }).catch(()=>{});
    }
});

let topCache = null;
let lastTopUpdate = 0;
app.get('/api/top', async (req, res) => {
    if (topCache && (Date.now() - lastTopUpdate < 180000)) return res.json(topCache);
    topCache = await User.findAll({ limit: 50, order: [['balance', 'DESC']], attributes: ['username', 'balance', 'level', 'photo_url'], raw: true });
    lastTopUpdate = Date.now();
    res.json(topCache);
});

app.get('/api/tasks', async (req, res) => res.json(await Task.findAll({ raw: true })));

// --- АДМИНКА (В ОТДЕЛЬНОМ КОНТЕЙНЕРЕ СЕССИЙ) ---
const startAdmin = async () => {
    const { default: connectSessionSequelize } = await import('connect-session-sequelize');
    const SequelizeStore = connectSessionSequelize(session.Store);
    const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
    
    const adminJs = new AdminJS({
        resources: [{ resource: User }, { resource: Task }, { resource: Stats }],
        rootPath: '/admin',
        bundler: { enabled: false },
        assets: { globals: { fonts: false, icons: false } }
    });

    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate: async (e, p) => (e === '1' && p === '1') ? { email: 'admin' } : null,
        cookiePassword: 'secure-pass-2026',
    }, null, {
        store: sessionStore, secret: 'secret', resave: false, saveUninitialized: false,
        cookie: { maxAge: 86400000 }
    });
    app.use(adminJs.options.rootPath, adminRouter);
};

// --- ТЕЛЕГРАМ ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    try {
        let user = await User.findByPk(userId, { raw: true });
        if (!user) {
            let bal = 0; let refBy = null;
            if (refId && refId !== userId) {
                refBy = refId; bal = 5000;
                User.increment({ balance: 10000, referrals: 1 }, { where: { id: refId } }).catch(()=>{});
            }
            await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: bal, referred_by: refBy });
        }
        ctx.replyWithPhoto({ source: path.join(__dirname, 'static/images/logo.png') }, {
            caption: `<b>Neural Pulse Terminal</b>\n\nID: <code>${userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ", DOMAIN)]])
        });
    } catch (e) { logger.error("Bot Start Err", e); }
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- СТАРТ ---
const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ alter: false });
        startAdmin(); // В фоне
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        setInterval(async () => {
            Stats.create({
                user_count: await User.count(),
                server_load: (os.loadavg()[0] * 10).toFixed(2),
                mem_usage: (process.memoryUsage().rss / 1024 / 1024).toFixed(2)
            }).catch(()=>{});
        }, 900000);

        logger.system(`Neural Pulse ULTRA-SPEED Online [${PORT}]`);
    } catch (err) { logger.error("CRITICAL", err); }
});
