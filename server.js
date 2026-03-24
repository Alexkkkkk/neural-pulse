import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes } from 'sequelize';
import os from 'os';

// Пакеты AdminJS (Версия 7+)
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Регистрация адаптера для работы AdminJS с Sequelize
AdminJS.registerAdapter(AdminJSSequelize);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false, 
    dialectOptions: { ssl: false },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
});

// --- СИСТЕМА СЕССИЙ ---
let sessionStore = null;
async function initSession() {
    try {
        const { default: connectSessionSequelize } = await import('connect-session-sequelize');
        const SequelizeStore = connectSessionSequelize(session.Store);
        sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
        console.log('✅ [STORAGE] Session store initialized.');
    } catch (e) {
        console.log('⚠️ [WARNING] Could not init SequelizeStore. Using MemoryStore.');
    }
}
await initSession();

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
    cookie: { 
        secure: true, 
        httpOnly: true, 
        sameSite: 'lax', 
        maxAge: 24 * 60 * 60 * 1000 
    }
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

// --- UTILS ---
const calculateLevel = (balance) => {
    if (balance < 10000) return 1;
    if (balance < 100000) return 2;
    if (balance < 500000) return 3;
    if (balance < 2000000) return 4;
    return 5;
};

// --- API ---
app.get('/api/user/:id', async (req, res) => {
    try {
        let user = await User.findByPk(req.params.id);
        if (!user) {
            user = await User.create({ id: req.params.id, username: req.query.username || 'AGENT' });
            return res.json(user);
        }

        const now = new Date();
        const lastSeen = new Date(user.last_seen);
        const secondsOffline = Math.floor((now - lastSeen) / 1000);

        // Офлайн прибыль (максимум за 24 часа)
        if (secondsOffline > 60 && user.profit > 0) {
            const farmTime = Math.min(secondsOffline, 86400); 
            const earned = (user.profit / 3600) * farmTime; 
            user.balance += parseFloat(earned.toFixed(2));
            user.last_seen = now;
            user.level = calculateLevel(user.balance);
            await user.save();
        }
        res.json(user);
    } catch (e) { res.status(500).send("DB Error"); }
});

app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        if (!id) return res.status(400).send("ID required");
        
        if (data.balance !== undefined) {
            data.level = calculateLevel(data.balance);
        }
        
        await User.update({ ...data, last_seen: new Date() }, { where: { id } });
        res.json({ ok: true });
    } catch (e) { res.status(500).send("Save Error"); }
});

// --- ADMIN PANEL (v7) ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Игроки' } } },
                { resource: Task, options: { navigation: { name: 'Квесты' } } },
                { resource: Stats, options: { navigation: { name: 'Метрики' } } }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse Control', withMadeWithLove: false }
        });

        // В AdminJS v7+ билд роутера требует передачи app и sessionOptions
        AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === '1' && password === '1') return { email: 'admin@pulse.com' };
                return null;
            },
            cookieName: 'adminjs_session',
            cookiePassword: 'secure-cookie-password-2026-final',
        }, app, sessionOptions); 

        console.log(`🚀 [ADMIN] Panel active at ${DOMAIN}/admin`);
    } catch (e) { console.error(`[ADMIN ERROR]`, e); }
};

// --- MONITORING ---
const collectMetrics = async () => {
    try {
        const userCount = await User.count();
        await Stats.create({
            user_count: userCount,
            server_load: parseFloat((os.loadavg()[0] * 10).toFixed(2)),
            mem_usage: parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(2))
        });
    } catch (e) { console.log("Metrics skipped."); }
};

// --- BOT LOGIC ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    const photoPath = path.join(__dirname, 'static/images/logo.png');

    try {
        let user = await User.findByPk(userId);
        if (!user) {
            let startBalance = 0;
            let referredBy = null;

            if (refId && refId !== userId) {
                const referrer = await User.findByPk(refId);
                if (referrer) {
                    referredBy = refId;
                    startBalance = 5000; // Бонус новому игроку
                    await referrer.update({ 
                        balance: referrer.balance + 10000, 
                        referrals: referrer.referrals + 1 
                    });
                    bot.telegram.sendMessage(refId, `💎 <b>Новый Агент!</b>\nВам начислено +10,000 NP.`, { parse_mode: 'HTML' }).catch(() => {});
                }
            }
            user = await User.create({ 
                id: userId, 
                username: ctx.from.username || 'AGENT', 
                balance: startBalance, 
                referred_by: referredBy 
            });
        }

        ctx.replyWithPhoto({ source: photoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nДобро пожаловать, Агент. Твоя нейросеть готова к работе.\n\n🎁 Реф. ссылка:\n<code>https://t.me/${ctx.botInfo.username}?start=${userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
        });
    } catch (e) { 
        ctx.reply("System Online.", Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])); 
    }
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

// --- SERVER RUN ---
const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
        await sequelize.authenticate();
        if (sessionStore) await sessionStore.sync().catch(() => {});
        await sequelize.sync({ alter: true }); 
        await startAdmin();
        
        await bot.telegram.deleteWebhook().catch(() => {});
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        setInterval(collectMetrics, 15 * 60 * 1000);
        setTimeout(collectMetrics, 5000); 
        
        console.log(`🚀 [SYSTEM ONLINE] on Port ${PORT}`);
    } catch (err) { console.error("Startup Failure:", err); }
});

process.on('SIGTERM', () => {
    server.close(async () => {
        await sequelize.close();
        process.exit(0);
    });
});
