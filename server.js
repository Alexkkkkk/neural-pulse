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
const PG_URI = "postgresql://bothost_db_db5b342fc026:gwp3jv20PY7JtERt4cNIvSpReq8YpLYzlH99BY5vyc4@node1.pghost.ru:32867/bothost_db_db5b342fc026";
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

const pool = new Pool({ connectionString: PG_URI });
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false, 
    dialectOptions: { ssl: false } 
});

// --- МОДЕЛИ (ИСПРАВЛЕНО) ---
const User = sequelize.define('users', {
    // Исправлено: добавлен primaryKey: true для корректного запуска
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: false },
    username: { type: DataTypes.STRING },
    photo_url: { type: DataTypes.TEXT },
    balance: { type: DataTypes.DOUBLE, defaultValue: 0 },
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    profit: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false });

const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primary_key: true, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING }
}, { timestamps: false });

const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    timestamp: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    user_count: { type: DataTypes.INTEGER },
    total_ton_deposits: { type: DataTypes.DOUBLE, defaultValue: 0 },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    db_response_time: { type: DataTypes.INTEGER }
}, { timestamps: false });

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
            db_response_time: dbTime,
            total_ton_deposits: 0 
        });
    } catch (e) { console.error("Metrics error:", e); }
};

// --- ADMIN JS (МАКСИМАЛЬНЫЙ ТЮНИНГ) ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Система', icon: 'User' } } },
                { resource: Task, options: { navigation: { name: 'Система', icon: 'Checklist' } } },
                { resource: Stats, options: { 
                    navigation: { name: 'Аналитика', icon: 'Activity' },
                    listProperties: ['timestamp', 'user_count', 'server_load', 'mem_usage', 'db_response_time'],
                    editProperties: [] 
                } }
            ],
            rootPath: '/admin',
            branding: { 
                companyName: 'Neural Pulse Control',
                softwareBrothers: false,
                logo: '/images/logo.png' 
            },
            dashboard: {
                handler: async () => {
                    const totalUsers = await User.count();
                    const lastStat = await Stats.findOne({ order: [['timestamp', 'DESC']] });
                    return {
                        totalUsers,
                        currentMem: lastStat?.mem_usage || 0,
                        dbLatency: lastStat?.db_response_time || 0,
                        cpu: lastStat?.server_load || 0
                    }
                },
                component: AdminJS.bundle('./dashboard-component.jsx')
            }
        });

        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === 'admin@pulse.com' && password === 'Kander3132001574') return { email };
                return null;
            },
            cookieName: 'adminjs_session',
            cookiePassword: 'super-long-secure-password-longer-than-32-chars-2026',
        }, null, { resave: false, saveUninitialized: true, secret: 'session_secret' });

        app.use(adminJs.options.rootPath, router);
    } catch (e) { console.error(`[ERR ADMIN]`, e); }
};

// --- API ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url } = req.query;
    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url) VALUES ($1, $2, $3) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '']
            );
            return res.json(newUser.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).send("DB Error"); }
});

app.post('/api/save', async (req, res) => {
    const d = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [d.userId, d.balance, d.energy, d.tap, d.profit]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).send("Save Error"); }
});

app.get('/api/top', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { res.status(500).send("Top Error"); }
});

app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks');
        res.json(result.rows);
    } catch (e) { res.status(500).send("Tasks Error"); }
});

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
        await sequelize.sync({ alter: true });
        await startAdmin();
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        
        setInterval(collectMetrics, 15 * 60 * 1000); 
        collectMetrics();

        console.log(`🚀 [MAX-MODE] System Online`);
    } catch (err) { console.error(err); }
});
