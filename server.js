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

// Регистрация адаптера
AdminJS.registerAdapter(AdminJSSequelize);

// --- КУСТОМНОЕ ЛОГИРОВАНИЕ ---
const logger = {
    info: (msg) => console.log(`[${new Date().toISOString()}] 🔵 INFO: ${msg}`),
    warn: (msg) => console.log(`[${new Date().toISOString()}] 🟡 WARN: ${msg}`),
    error: (msg, err) => console.error(`[${new Date().toISOString()}] 🔴 ERROR: ${msg}`, err || ''),
    system: (msg) => console.log(`[${new Date().toISOString()}] 🚀 SYSTEM: ${msg}`),
    ai: (msg) => console.log(`[${new Date().toISOString()}] 📟 AI_LOG: ${msg}`)
};

// --- CONFIG ---
const OPENAI_API_KEY = "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";
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;
const ADMIN_ID = 1774360651;

// Инициализация ИИ
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// ОПТИМИЗАЦИЯ БД: logging: false для скорости и увеличенный пул соединений
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false, // Отключено для ускорения обработки запросов
    dialectOptions: { ssl: false, connectTimeout: 60000 },
    pool: { max: 20, min: 5, acquire: 30000, idle: 10000 }
});

// --- СИСТЕМА СЕССИЙ ---
let sessionStore = null;
async function initSession() {
    try {
        const { default: connectSessionSequelize } = await import('connect-session-sequelize');
        const SequelizeStore = connectSessionSequelize(session.Store);
        sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
        logger.system('Neural Network Sessions Linked.');
    } catch (e) {
        logger.error('SessionStore failure', e);
    }
}
await initSession();

app.set('trust proxy', 1); 
app.use(cors());
app.use(express.json());

// Настройки сессии
const sessionOptions = {
    secret: 'neural_pulse_ultra_secret_2026',
    store: sessionStore, 
    resave: false, 
    saveUninitialized: false, 
    proxy: true,
    name: 'neural_pulse_sid',
    cookie: { 
        secure: false, 
        httpOnly: true, 
        sameSite: 'lax', 
        maxAge: 24 * 60 * 60 * 1000 
    }
};

app.use(session(sessionOptions));

// ОПТИМИЗАЦИЯ СТАТИКИ: кэширование на стороне браузера (1 день)
app.use(express.static(path.join(__dirname, 'static'), { maxAge: '1d' }));

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
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    last_bonus: { type: DataTypes.DATE },
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false });

const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false, unique: true },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING }
}, { timestamps: false });

const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    timestamp: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    user_count: { type: DataTypes.INTEGER },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT }
}, { timestamps: false });

const calculateLevel = (balance) => {
    if (balance < 10000) return 1;
    if (balance < 100000) return 2;
    if (balance < 500000) return 3;
    if (balance < 2000000) return 4;
    return 5;
};

// --- API ---

app.post('/api/ai-advice', async (req, res) => {
    try {
        const userData = req.body;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Ты — ИИ-советник терминала Neural Pulse. Дай краткий, дерзкий совет игроку на основе его статов. Используй киберпанк сленг. Максимум 2 предложения." },
                { role: "user", content: `Статы: Баланс ${userData.balance}, Доход в час ${userData.profit}, Сила тапа ${userData.tap}.` }
            ]
        });
        res.json({ text: completion.choices[0].message.content });
    } catch (e) {
        res.status(500).json({ text: "Нейросеть перегружена." });
    }
});

app.get('/api/user/:id', async (req, res) => {
    try {
        let user = await User.findByPk(req.params.id);
        if (!user) {
            user = await User.create({ id: req.params.id, username: req.query.username || 'AGENT' });
            return res.json(user);
        }

        const now = new Date();
        const secondsOffline = Math.floor((now - new Date(user.last_seen)) / 1000);

        if (secondsOffline > 60 && user.profit > 0) {
            const farmTime = Math.min(secondsOffline, 86400); 
            const earned = (user.profit / 3600) * farmTime; 
            user.balance += parseFloat(earned.toFixed(2));
            user.last_seen = now;
            user.level = calculateLevel(user.balance);
            await user.save();
        }
        res.json(user);
    } catch (e) { res.status(500).send("AI_CORE_ERROR"); }
});

app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        if (!id) return res.status(400).send("ID_MISSING");
        if (data.balance !== undefined) data.level = calculateLevel(data.balance);
        await User.update({ ...data, last_seen: new Date() }, { where: { id } });
        res.json({ ok: true });
    } catch (e) { res.status(500).send("SAVE_ERROR"); }
});

app.get('/api/top', async (req, res) => {
    try {
        const top = await User.findAll({ limit: 50, order: [['balance', 'DESC']], attributes: ['username', 'balance', 'level', 'photo_url'] });
        res.json(top);
    } catch (e) { res.status(500).json([]); }
});

app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.findAll();
        res.json(tasks);
    } catch (e) { res.status(500).json([]); }
});

// --- ADMIN (ОПТИМИЗИРОВАНО) ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Агенты' } } },
                { resource: Task, options: { navigation: { name: 'Контракты' } } },
                { resource: Stats, options: { navigation: { name: 'Система' } } }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse Hub', logo: false },
            bundler: { enabled: false }, // ОТКЛЮЧЕН БИЛД ДЛЯ СКОРОСТИ
            assets: { globals: { fonts: false } }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => (email === '1' && password === '1') ? { email: 'admin@pulse.tech' } : null,
            cookieName: 'adminjs_session',
            cookiePassword: 'secure-ai-pass-2026',
        }, null, sessionOptions);

        app.use(adminJs.options.rootPath, adminRouter);
        logger.system('Admin Panel Interface Online.');
    } catch (e) { logger.error("Admin init failed", e); }
};

// --- BOT LOGIC ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    const photoPath = path.join(__dirname, 'static/images/logo.png');

    try {
        let user = await User.findByPk(userId);
        if (!user) {
            let startBalance = 0; let referredBy = null;
            if (refId && refId !== userId) {
                const referrer = await User.findByPk(refId);
                if (referrer) {
                    referredBy = refId; startBalance = 5000;
                    await referrer.update({ balance: referrer.balance + 10000, referrals: referrer.referrals + 1 });
                    bot.telegram.sendMessage(refId, `✅ <b>Система:</b> Новый агент! +10k NP.`, { parse_mode: 'HTML' }).catch(() => {});
                }
            }
            user = await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: startBalance, referred_by: referredBy });
        }

        ctx.replyWithPhoto({ source: photoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nИдентификация пройдена.\n🔗 <code>https://t.me/${ctx.botInfo.username}?start=${userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ", DOMAIN)]])
        }).catch(() => ctx.reply("System Online.", Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ", DOMAIN)]])));
    } catch (e) { logger.error(`Bot Fail`, e); }
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- RUN (СУПЕР БЫСТРЫЙ СТАРТ) ---
const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
        await sequelize.authenticate();
        if (sessionStore) await sessionStore.sync().catch(() => {});
        
        // alter: false ускоряет запуск, так как не проверяет таблицы каждый раз
        await sequelize.sync({ alter: false }); 
        
        // Запускаем админку параллельно, не блокируя основной поток
        startAdmin(); 
        
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        // Интервалы
        setInterval(async () => {
            const metrics = {
                user_count: await User.count(),
                server_load: parseFloat((os.loadavg()[0] * 10).toFixed(2)),
                mem_usage: parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2))
            };
            Stats.create(metrics).catch(() => {});
        }, 15 * 60 * 1000);

        logger.system(`Neural Pulse Core Online [Port ${PORT}]`);
    } catch (err) { logger.error("CRITICAL", err); }
});

process.on('SIGTERM', () => server.close(async () => { 
    await sequelize.close(); 
    process.exit(0); 
}));
