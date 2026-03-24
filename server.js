import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes } from 'sequelize';
import os from 'os';

// --- ДИНАМИЧЕСКИЙ ИМПОРТ ---
let connectSessionSequelize;
try {
    const mod = await import('connect-session-sequelize');
    connectSessionSequelize = mod.default;
    console.log('--- [STORAGE] connect-session-sequelize detected ---');
} catch (e) {
    console.log('--- [WARNING] connect-session-sequelize not found. Using MemoryStore. ---');
}

import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSSequelize);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const sequelize = new Sequelize(PG_URI, { dialect: 'postgres', logging: false, dialectOptions: { ssl: false } });

// --- SESSION STORE ---
let sessionStore = null;
if (connectSessionSequelize) {
    const SequelizeStore = connectSessionSequelize(session.Store);
    sessionStore = new SequelizeStore({ 
        db: sequelize, 
        tableName: 'sessions',
        checkExpirationInterval: 15 * 60 * 1000,
        expiration: 24 * 60 * 60 * 1000 
    });
}

app.set('trust proxy', 1); 
app.use(cors());
app.use(express.json());

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
    profit: { type: DataTypes.INTEGER, defaultValue: 0 }, // Прибыль в секунду (или в час, смотря как настроишь)
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
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
    mem_usage: { type: DataTypes.FLOAT },
    db_response_time: { type: DataTypes.INTEGER }
}, { timestamps: false });

// --- API С ЛОГИКОЙ ОФЛАЙН-ПРИБЫЛИ ---
app.get('/api/user/:id', async (req, res) => {
    try {
        let user = await User.findByPk(req.params.id);
        if (!user) {
            user = await User.create({ id: req.params.id, username: req.query.username || 'AGENT' });
            return res.json(user);
        }

        // РАСЧЕТ ОФЛАЙН ДОХОДА
        const now = new Date();
        const lastSeen = new Date(user.last_seen);
        const secondsOffline = Math.floor((now - lastSeen) / 1000);

        if (secondsOffline > 60 && user.profit > 0) {
            // Ограничиваем фарм 24 часами (86400 сек)
            const farmTime = Math.min(secondsOffline, 86400); 
            const earned = (user.profit / 3600) * farmTime; // Если profit указан "в час"
            
            user.balance += parseFloat(earned.toFixed(2));
            user.last_seen = now;
            await user.save();
            
            console.log(`[FARM] User ${user.id} earned ${earned.toFixed(2)} while offline`);
        }

        res.json(user);
    } catch (e) { res.status(500).send("DB Error"); }
});

app.post('/api/save', async (req, res) => {
    try {
        await User.update({ ...req.body, last_seen: new Date() }, { where: { id: req.body.id } });
        res.json({ ok: true });
    } catch (e) { res.status(500).send("Save Error"); }
});

app.get('/api/tasks', async (req, res) => {
    try { res.json(await Task.findAll()); } catch (e) { res.status(500).send("Error"); }
});

// --- ADMIN ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Players' } } },
                { resource: Task, options: { navigation: { name: 'Quests' } } },
                { resource: Stats, options: { navigation: { name: 'Metrics' } } }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse Control', withMadeWithLove: false }
        });

        const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') return { email: 'admin@pulse.com' };
                return null;
            },
            cookieName: 'adminjs_session',
            cookiePassword: 'secure-cookie-password-2026-final',
        }, null, sessionOptions);

        app.use(adminJs.options.rootPath, adminRouter);
        console.log(`--- [ADMIN] AdminJS panel ready at /admin ---`);
    } catch (e) { console.error(`[ADMIN ERROR]`, e); }
};

// --- MONITORING ---
const collectMetrics = async () => {
    try {
        const userCount = await User.count();
        await Stats.create({
            user_count: userCount,
            server_load: parseFloat((os.loadavg()[0] * 10).toFixed(2)),
            mem_usage: parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2)),
            db_response_time: 0
        });
    } catch (e) { console.log("Metrics collection skipped."); }
};

// --- BOT ---
bot.start(async (ctx) => {
    const photoPath = path.join(__dirname, 'static/images/logo.png');
    ctx.replyWithPhoto({ source: photoPath }, {
        caption: `<b>Neural Pulse | Terminal</b>\n\nДобро пожаловать, Агент. Твоя нейросеть готова к работе.`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
    }).catch(() => ctx.reply("System Online", Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])));
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- RUN ---
app.listen(PORT, '0.0.0.0', async () => {
    try {
        await sequelize.authenticate();
        console.log('--- [DB] Connection established ---');

        if (sessionStore) {
            await sessionStore.sync().catch(e => console.log("Session sync skip"));
        }
        
        await sequelize.sync({ alter: true }); 
        await startAdmin();
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        setInterval(collectMetrics, 15 * 60 * 1000);
        setTimeout(collectMetrics, 10000); 
        
        console.log(`🚀 [SYSTEM ONLINE]`);
    } catch (err) { console.error("Startup Failure:", err); }
});
