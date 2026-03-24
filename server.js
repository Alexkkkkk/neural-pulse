import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes } from 'sequelize';
import os from 'os';

import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSSequelize);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json());
app.use(session({
    secret: 'neural_pulse_ultra_secret_2026',
    resave: false,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'static')));

const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false, 
    dialectOptions: { ssl: false } 
});

// --- МОДЕЛИ ---
const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: false },
    username: { type: DataTypes.STRING },
    photo_url: { type: DataTypes.TEXT },
    balance: { type: DataTypes.DOUBLE, defaultValue: 0 },
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    profit: { type: DataTypes.INTEGER, defaultValue: 0 },
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
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

// --- API ---

// Загрузка или создание пользователя
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url } = req.query;
    try {
        let user = await User.findByPk(userId);
        if (!user) {
            user = await User.create({
                id: userId,
                username: username || 'AGENT',
                photo_url: photo_url || ''
            });
        }
        res.json(user);
    } catch (e) { 
        console.error("Load User Error:", e);
        res.status(500).send("DB Error"); 
    }
});

// Сохранение прогресса (Все кнопки апгрейдов вызывают этот метод)
app.post('/api/save', async (req, res) => {
    const d = req.body;
    if (!d.id) return res.status(400).send("No ID");
    
    try {
        await User.update({
            balance: d.balance,
            energy: d.energy,
            max_energy: d.max_energy,
            tap: d.tap,
            profit: d.profit,
            tap_lvl: d.tap_lvl,
            mine_lvl: d.mine_lvl,
            energy_lvl: d.energy_lvl,
            last_seen: new Date()
        }, { where: { id: d.id } });
        
        res.json({ ok: true });
    } catch (e) { 
        console.error("Save Error:", e);
        res.status(500).send("Save Error"); 
    }
});

// Список заданий для фронтенда
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.findAll();
        res.json(tasks);
    } catch (e) { res.status(500).send("Tasks Error"); }
});

app.get('/api/top', async (req, res) => {
    try {
        const topUsers = await User.findAll({
            order: [['balance', 'DESC']],
            limit: 50,
            attributes: ['username', 'balance', 'photo_url']
        });
        res.json(topUsers);
    } catch (e) { res.status(500).send("Top Error"); }
});

// --- АДМИНКА ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Players', icon: 'User' } } },
                { resource: Task, options: { navigation: { name: 'Quests', icon: 'Checklist' } } },
                { resource: Stats, options: { navigation: { name: 'Metrics', icon: 'Activity' } } }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse Control', logo: '/images/logo.png' }
        });

        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === 'admin@pulse.com' && password === 'Kander3132001574') return { email };
                return null;
            },
            cookieName: 'adminjs_session',
            cookiePassword: 'secure-cookie-password-2026-v2',
        }, null, { resave: false, saveUninitialized: true, secret: 'session_secret' });

        app.use(adminJs.options.rootPath, router);
    } catch (e) { console.error(`[ADMIN ERROR]`, e); }
};

// --- МОНИТОРИНГ ---
const collectMetrics = async () => {
    try {
        const startDb = Date.now();
        const userCount = await User.count();
        const dbTime = Date.now() - startDb;
        const memUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const cpuLoad = (os.loadavg()[0] * 10).toFixed(2);

        await Stats.create({
            user_count: userCount,
            server_load: parseFloat(cpuLoad),
            mem_usage: parseFloat(memUsed),
            db_response_time: dbTime
        });
    } catch (e) { console.log("Metrics silent error"); }
};

// --- ЗАПУСК ---
bot.start((ctx) => {
    ctx.reply(`<b>Neural Pulse | Terminal</b>`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    try {
        await sequelize.authenticate();
        // alter: true гарантирует, что tap_lvl, mine_lvl и energy_lvl появятся в БД
        await sequelize.sync({ alter: true }); 
        await startAdmin();
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        setInterval(collectMetrics, 15 * 60 * 1000); 
        collectMetrics();

        console.log(`🚀 [SYSTEM ONLINE] Database & Bot Connected`);
    } catch (err) { console.error("Startup Failure:", err); }
});
