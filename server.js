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
const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;
const ADMIN_ID = 1774360651;

// Инициализация ИИ (Вставь ключ в переменные окружения Bothost или сюда)
const openai = new OpenAI({ apiKey: 'YOUR_OPENAI_API_KEY' });

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: (msg) => logger.info(`[DB] ${msg.substring(0, 100)}...`),
    dialectOptions: { ssl: false },
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 }
});

// --- СИСТЕМА СЕССИЙ ---
let sessionStore = null;
async function initSession() {
    try {
        const { default: connectSessionSequelize } = await import('connect-session-sequelize');
        const SequelizeStore = connectSessionSequelize(session.Store);
        sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
        logger.system('Session store connected to DB.');
    } catch (e) {
        logger.error('SessionStore initialization failed', e);
    }
}
await initSession();

app.set('trust proxy', 1); 
app.use(cors());
app.use(express.json());

// Логирование входящих API запросов
app.use((req, res, next) => {
    if (!req.url.startsWith('/admin')) { // Не заспамливаем логи админкой
        logger.info(`HTTP ${req.method} ${req.url}`);
    }
    next();
});

const sessionOptions = {
    secret: 'neural_pulse_ultra_secret_2026',
    store: sessionStore, 
    resave: false, 
    saveUninitialized: false, 
    proxy: true,
    name: 'neural_pulse_sid',
    cookie: { secure: true, httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
};

app.use(session(sessionOptions));
app.use(express.static(path.join(__dirname, 'static')));

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

// --- AI ENGINE & SECURITY ---
const AIEngine = {
    async getGlobalReport() {
        try {
            const count = await User.count();
            const top = await User.findAll({ limit: 5, order: [['balance', 'DESC']] });
            logger.ai('Generating global economy report...');
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: "Ты ИИ Neural Pulse. Дай анализ экономики." }, { role: "user", content: `Игроков: ${count}. Топ: ${JSON.stringify(top)}` }]
            });
            return completion.choices[0].message.content;
        } catch (e) { 
            logger.error('AI Report Error', e);
            return "Ошибка протокола ИИ."; 
        }
    },
    async scanSuspects() {
        logger.info('Starting security scan for suspected cheaters...');
        const suspects = await User.findAll({
            where: { balance: { [Op.gt]: 5000000 }, level: { [Op.lt]: 2 } } // Порог 5 млн для подозрений
        });
        for (let u of suspects) {
            await u.update({ status: 'suspected' });
            logger.warn(`User ${u.id} (${u.username}) marked as suspected.`);
        }
    }
};

const calculateLevel = (balance) => {
    if (balance < 10000) return 1;
    if (balance < 100000) return 2;
    if (balance < 500000) return 3;
    if (balance < 2000000) return 4;
    return 5;
};

// --- API ROUTES ---

// Получить данные пользователя + оффлайн фарм
app.get('/api/user/:id', async (req, res) => {
    try {
        let user = await User.findByPk(req.params.id);
        if (!user) {
            user = await User.create({ id: req.params.id, username: req.query.username || 'AGENT' });
            logger.info(`New user created: ${req.params.id}`);
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
            logger.info(`User ${user.id} farmed ${earned.toFixed(2)} NP offline.`);
        }
        res.json(user);
    } catch (e) { 
        logger.error(`API GET /api/user/${req.params.id} failed`, e);
        res.status(500).send("DB Error"); 
    }
});

// Сохранение прогресса (тапы, энергия)
app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        if (!id) return res.status(400).send("ID required");
        if (data.balance !== undefined) data.level = calculateLevel(data.balance);
        await User.update({ ...data, last_seen: new Date() }, { where: { id } });
        res.json({ ok: true });
    } catch (e) { 
        logger.error(`API POST /api/save failed`, e);
        res.status(500).send("Save Error"); 
    }
});

// ТОП игроков (то, что искал твой фронтенд)
app.get('/api/top', async (req, res) => {
    try {
        const topUsers = await User.findAll({
            limit: 50,
            order: [['balance', 'DESC']],
            attributes: ['username', 'balance', 'level', 'photo_url']
        });
        res.json(topUsers);
    } catch (e) {
        logger.error("API GET /api/top failed", e);
        res.status(500).json([]);
    }
});

// Список квестов
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.findAll();
        res.json(tasks);
    } catch (e) {
        logger.error("API GET /api/tasks failed", e);
        res.status(500).json([]);
    }
});

// --- ADMIN PANEL ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Игроки' } } },
                { resource: Task, options: { navigation: { name: 'Квесты' } } },
                { resource: Stats, options: { navigation: { name: 'Метрики' } } }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse Control', logo: false },
            bundler: { enabled: false }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => (email === '1' && password === '1') ? { email: 'admin@pulse.com' } : null,
            cookieName: 'adminjs_session',
            cookiePassword: 'secure-cookie-password-2026-final',
        }, null, sessionOptions);

        app.use(adminJs.options.rootPath, adminRouter);
        logger.system(`Admin panel ready at ${DOMAIN}/admin`);
    } catch (e) { logger.error("Admin setup failed", e); }
};

// --- MONITORING ---
const collectMetrics = async () => {
    try {
        const userCount = await User.count();
        const metrics = {
            user_count: userCount,
            server_load: parseFloat((os.loadavg()[0] * 10).toFixed(2)),
            mem_usage: parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2))
        };
        await Stats.create(metrics);
        logger.info(`Metrics: Users: ${metrics.user_count}, RAM: ${metrics.mem_usage}MB`);
    } catch (e) { logger.error("Metrics collection failed", e); }
};

// --- BOT LOGIC ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    const photoPath = path.join(__dirname, 'static/images/logo.png');

    logger.info(`Bot /start by user ${userId} (Ref: ${refId || 'None'})`);

    try {
        let user = await User.findByPk(userId);
        if (!user) {
            let startBalance = 0; let referredBy = null;
            if (refId && refId !== userId) {
                const referrer = await User.findByPk(refId);
                if (referrer) {
                    referredBy = refId; startBalance = 5000;
                    await referrer.update({ balance: referrer.balance + 10000, referrals: referrer.referrals + 1 });
                    bot.telegram.sendMessage(refId, `💎 <b>Агент принят!</b>\n+10,000 NP на баланс.`, { parse_mode: 'HTML' }).catch(() => {});
                }
            }
            user = await User.create({ id: userId, username: ctx.from.username || 'AGENT', balance: startBalance, referred_by: referredBy });
        }

        ctx.replyWithPhoto({ source: photoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nАгент, система инициализирована.\n\n🎁 Реф. ссылка:\n<code>https://t.me/${ctx.botInfo.username}?start=${userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
        }).catch(() => ctx.reply("System Online.", Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])));
    } catch (e) { logger.error(`Bot /start failed`, e); }
});

bot.command('ai_report', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("⌛ Анализирую нейронную сеть...");
    const report = await AIEngine.getGlobalReport();
    ctx.reply(`📊 <b>ОТЧЕТ ИИ:</b>\n\n${report}`, { parse_mode: 'HTML' });
});

bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    try {
        await ctx.sendChatAction('typing');
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "Ты ИИ Neural Pulse. Твой стиль: киберпанк, хакер, кратко." }, { role: "user", content: ctx.message.text }]
        });
        ctx.reply(`📟: ${response.choices[0].message.content}`);
    } catch (e) { }
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- SERVER RUN ---
const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
        logger.system(`Initializing database connection...`);
        await sequelize.authenticate();
        if (sessionStore) await sessionStore.sync().catch(() => {});
        await sequelize.sync({ alter: true }); 
        
        await startAdmin();
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        setInterval(collectMetrics, 15 * 60 * 1000);
        setInterval(() => AIEngine.scanSuspects(), 60 * 60 * 1000);
        
        logger.system(`Neural Pulse ONLINE on Port ${PORT}`);
    } catch (err) { logger.error("CRITICAL Startup Failure", err); }
});

process.on('SIGTERM', () => server.close(async () => { 
    logger.system("SIGTERM received. Cleaning up...");
    await sequelize.close(); 
    process.exit(0); 
}));
