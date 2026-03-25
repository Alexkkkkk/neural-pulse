import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes, Op } from 'sequelize';
import os from 'os';

// AdminJS (v7+)
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
AdminJS.registerAdapter(AdminJSSequelize);

// --- УЛУЧШЕННАЯ СИСТЕМА ЛОГИРОВАНИЯ ---
const logger = {
    info: (msg) => console.log(`[${new Date().toLocaleString()}] 🔵 INFO: ${msg}`),
    system: (msg) => console.log(`[${new Date().toLocaleString()}] 🚀 SYSTEM: ${msg}`),
    warn: (msg) => console.log(`[${new Date().toLocaleString()}] 🟡 WARN: ${msg}`),
    error: (msg, err) => {
        console.error(`[${new Date().toLocaleString()}] 🔴 ERROR: ${msg}`);
        if (err) console.error(err);
    },
    http: (req, res, next) => {
        // Логируем только API запросы, чтобы не забивать консоль статикой
        if (req.url.startsWith('/api')) {
            console.log(`[${new Date().toLocaleString()}] 🌐 HTTP: ${req.method} ${req.url} - IP: ${req.ip}`);
        }
        next();
    }
};

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- MIDDLEWARES & ОПТИМИЗАЦИЯ ---
app.disable('x-powered-by'); 
app.disable('etag'); 
app.set('trust proxy', 1);
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(logger.http); // Подключаем логирование HTTP запросов

app.use(express.static(path.join(__dirname, 'static'), { 
    maxAge: '30d', 
    immutable: true
}));

// --- БАЗА ДАННЫХ ---
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: (msg) => {
        // Логируем медленные запросы или ошибки SQL, если нужно
        if (msg.includes('ERROR')) logger.error('SQL Error', msg);
    },
    dialectOptions: { ssl: false, connectTimeout: 15000 },
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
    profit: { type: DataTypes.DOUBLE, defaultValue: 0 }, 
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
    referred_by: { type: DataTypes.BIGINT, allowNull: true },
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
            logger.info(`New user registration attempt: ${userId}`);
            const newUser = await User.create({ 
                id: userId, 
                username: req.query.username || 'AGENT',
                last_bonus: 0 
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
            await user.save().catch(e => logger.error('Failed to save user offline profit', e));
            logger.info(`User ${userId} earned ${earned.toFixed(2)} offline`);
        }
        res.json(user);
    } catch (e) { 
        logger.error(`API Sync error for user ${req.params.id}`, e);
        res.status(500).send("AI_CORE_OFFLINE"); 
    }
});

app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        if (!id) return res.status(400).json({ error: "ID Missing" });

        const userId = BigInt(id);
        if (data.balance !== undefined) data.level = calculateLevel(data.balance);
        
        delete data.id;

        const [updated] = await User.update(
            { ...data, last_seen: new Date() }, 
            { where: { id: userId } }
        );

        if (updated === 0) {
            logger.warn(`Save triggered for non-existent user ${userId}, creating...`);
            await User.create({ id: userId, ...data });
        }

        res.json({ ok: true });
    } catch (e) {
        logger.error(`SAVE FAILURE for user ${req.body?.id}`, e);
        res.status(500).json({ error: "DB Error" });
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
        logger.system('Admin Panel Security Layer Active.');
    } catch (e) { logger.error("Admin System Error", e); }
};

// --- TELEGRAM BOT ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refIdRaw = ctx.startPayload ? ctx.startPayload : null;
    const logoPath = path.join(__dirname, 'static/images/logo.png');

    logger.info(`Bot /start from ${userId} (username: ${ctx.from.username})`);

    try {
        let user = await User.findByPk(userId);
        if (!user) {
            let startBal = 0; 
            let refBy = null;
            
            if (refIdRaw && BigInt(refIdRaw) !== BigInt(userId)) {
                refBy = BigInt(refIdRaw); 
                startBal = 5000;
                logger.info(`Referral detected: ${userId} invited by ${refBy}`);
                await User.increment({ balance: 10000, referrals: 1 }, { where: { id: refBy } }).catch(e => logger.error('Ref bonus fail', e));
            }
            
            user = await User.create({ 
                id: userId, 
                username: ctx.from.username || ctx.from.first_name || 'AGENT', 
                balance: startBal, 
                referred_by: refBy, 
                last_bonus: 0 
            });
        }
        
        ctx.replyWithPhoto({ source: logoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nИдентификация пройдена.\nАгент: <code>${ctx.from.username || userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]])
        });
    } catch (e) { logger.error(`Bot Logic Crash for user ${userId}`, e); }
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- ENGINE START ---
const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
        logger.system('Initializing Engine components...');
        await sequelize.authenticate();
        logger.system('Database connected.');
        
        await sequelize.sync({ alter: true }); 
        logger.system('Models synchronized.');

        startAdmin(); 
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        logger.system(`Webhook set to: ${DOMAIN}${WEBHOOK_PATH}`);
        
        setInterval(async () => {
            try {
                const uCount = await User.count();
                const load = parseFloat((os.loadavg()[0] * 10).toFixed(2));
                const mem = parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2));
                
                await Stats.create({
                    user_count: uCount,
                    server_load: load,
                    mem_usage: mem
                });
                logger.info(`Stats updated: Users: ${uCount}, Load: ${load}, Mem: ${mem}MB`);
            } catch (err) { logger.error('Stats interval failed', err); }
        }, 900000); 

        logger.system(`Neural Pulse ULTRA-SPEED Online [Port ${PORT}]`);
    } catch (err) { logger.error("CRITICAL ENGINE FAILURE", err); }
});

process.on('SIGTERM', () => server.close(async () => { 
    logger.system('SIGTERM received. Shutting down...');
    await sequelize.close(); 
    process.exit(0); 
}));
