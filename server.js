import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes, Op } from 'sequelize';
import os from 'os';
import OpenAI from 'openai';

// AdminJS (v7+)
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
AdminJS.registerAdapter(AdminJSSequelize);

// --- СИСТЕМА ЛОГИРОВАНИЯ ---
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

// --- УЛЬТРА ОПТИМИЗАЦИЯ EXPRESS ---
app.disable('x-powered-by'); 
app.disable('etag'); 
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(express.static(path.join(__dirname, 'static'), { 
    maxAge: '30d', 
    immutable: true,
    lastModified: false
}));

// --- БАЗА ДАННЫХ ---
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false, 
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
    profit: { type: DataTypes.INTEGER, defaultValue: 0 }, 
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
    referred_by: { type: DataTypes.BIGINT, allowNull: true },
    last_bonus: { type: DataTypes.BIGINT, defaultValue: 0 }, // Добавлено для бонусов
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
        const user = await User.findByPk(req.params.id, { raw: true });
        if (!user) {
            const newUser = await User.create({ id: req.params.id, username: req.query.username || 'AGENT' });
            return res.json(newUser);
        }
        
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
    } catch (e) { res.status(500).send("AI_CORE_OFFLINE"); }
});

app.post('/api/save', (req, res) => {
    res.status(202).json({ ok: true }); 
    const { id, ...data } = req.body;
    if (id) {
        if (data.balance) data.level = calculateLevel(data.balance);
        User.update({ ...data, last_seen: new Date() }, { where: { id } }).catch(()=>{});
    }
});

// --- AI ADVICE ENGINE ---
app.post('/api/ai-advice', async (req, res) => {
    try {
        const { id, balance, levels } = req.body;
        
        const prompt = `
            Ты — терминал "Neural Pulse". Проанализируй данные Агента и дай краткий совет (1-2 предложения).
            Статус: Баланс ${Math.floor(balance)} NP, Тап-уровень ${levels.tap}, Майнинг-уровень ${levels.mine}.
            Тон: Технологичный, киберпанк, немного дерзкий. Используй слова: "протокол", "синхронизация", "мощности".
            Если майнинг (mine) меньше тапа, посоветуй пассивный доход.
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "Ты — бортовой ИИ." }, { role: "user", content: prompt }],
            max_tokens: 80
        });

        res.json({ text: response.choices[0].message.content.trim() });
    } catch (e) {
        logger.error("AI Advice Failure", e);
        res.json({ text: "Анализ прерван: Нейросеть перегружена. Увеличивай мощность узлов самостоятельно, Агент." });
    }
});

app.get('/api/top', async (req, res) => {
    try {
        const users = await User.findAll({ 
            limit: 50, 
            order: [['balance', 'DESC']], 
            attributes: ['username', 'balance', 'level', 'photo_url'], 
            raw: true 
        });
        res.json(users);
    } catch (e) { res.json([]); }
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
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    const logoPath = path.join(__dirname, 'static/images/logo.png');

    try {
        let user = await User.findByPk(userId, { raw: true });
        if (!user) {
            let startBal = 0; let refBy = null;
            if (refId && refId !== userId) {
                refBy = refId; startBal = 5000;
                User.increment({ balance: 10000, referrals: 1 }, { where: { id: refId } }).catch(()=>{});
            }
            await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: startBal, referred_by: refBy });
        }
        
        ctx.replyWithPhoto({ source: logoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nИдентификация пройдена.\nАгент: <code>${ctx.from.username || userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]])
        }).catch(() => ctx.reply("Система онлайн.", Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]])));
    } catch (e) { logger.error("Bot Logic Crash", e); }
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- ENGINE START ---
const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ alter: false });
        startAdmin(); 
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        setInterval(async () => {
            Stats.create({
                user_count: await User.count(),
                server_load: parseFloat((os.loadavg()[0] * 10).toFixed(2)),
                mem_usage: parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2))
            }).catch(()=>{});
        }, 900000);

        logger.system(`Neural Pulse ULTRA-SPEED Online [Port ${PORT}]`);
    } catch (err) { logger.error("CRITICAL ENGINE FAILURE", err); }
});

process.on('SIGTERM', () => server.close(async () => { 
    await sequelize.close(); 
    process.exit(0); 
}));
