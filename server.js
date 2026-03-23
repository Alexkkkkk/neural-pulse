import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes } from 'sequelize';

import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSSequelize);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_db5b342fc026:gwp3jv20PY7JtERt4cNIvSpReq8YpLYzlH99BY5vyc4@node1.pghost.ru:32867/bothost_db_db5b342fc026";
const DOMAIN = "https://neural-pulse.bothost.ru"; 
const PORT = 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json());
app.use(session({
    secret: 'neural_pulse_2026_final',
    resave: false,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'static')));

// Логгер входящих HTTP запросов
app.use((req, res, next) => {
    if (req.url !== '/telegraf/' + BOT_TOKEN) { // Не спамим логами вебхука бота
        console.log(`[HTTP] ${req.method} ${req.url}`);
    }
    next();
});

const pool = new Pool({ connectionString: PG_URI, ssl: false });
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: (msg) => console.log(`[DB-SQL] ${msg}`), // Логируем SQL запросы Sequelize
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
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false });

const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING }
}, { timestamps: false });

// --- API ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, photo_url } = req.query;
    console.log(`[API] Запрос данных пользователя: ${userId} (${username || 'no name'})`);
    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            console.log(`[API] Новый пользователь! Регистрация: ${userId}`);
            const newUser = await pool.query(
                `INSERT INTO users (id, username, photo_url) VALUES ($1, $2, $3) RETURNING *`,
                [userId, username || 'AGENT', photo_url || '']
            );
            return res.json(newUser.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (e) { 
        console.error(`[API ERROR] /api/user/:id : ${e.message}`);
        res.status(500).json({ error: "DB Error" }); 
    }
});

app.post('/api/save', async (req, res) => {
    const d = req.body;
    console.log(`[API] Сохранение: User ${d.userId} | Balance: ${d.balance} | Energy: ${d.energy}`);
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [d.userId, d.balance, d.energy, d.tap, d.profit]
        );
        res.json({ ok: true });
    } catch (e) { 
        console.error(`[API ERROR] /api/save : ${e.message}`);
        res.status(500).json({ error: "Save error" }); 
    }
});

app.get('/api/top', async (req, res) => {
    console.log(`[API] Запрос таблицы лидеров`);
    try {
        const result = await pool.query('SELECT id, username, balance, photo_url FROM users ORDER BY balance DESC LIMIT 50');
        res.json(result.rows);
    } catch (e) { 
        console.error(`[API ERROR] /api/top : ${e.message}`);
        res.status(500).json({ error: "Top error" }); 
    }
});

app.get('/api/tasks', async (req, res) => {
    console.log(`[API] Запрос списка заданий`);
    try {
        const result = await pool.query('SELECT * FROM tasks');
        res.json(result.rows);
    } catch (e) { 
        console.error(`[API ERROR] /api/tasks : ${e.message}`);
        res.status(500).json({ error: e.message }); 
    }
});

// --- ADMIN ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { resource: User, options: { navigation: { name: 'Игроки', icon: 'User' } } },
                { resource: Task, options: { navigation: { name: 'Задания', icon: 'Checklist' } } }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Admin', softwareBrothers: false }
        });
        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === 'admin@pulse.com' && password === 'Kander3132001574') {
                    console.log(`[ADMIN] Успешный вход: ${email}`);
                    return { email };
                }
                console.warn(`[ADMIN] Неудачная попытка входа: ${email}`);
                return null;
            },
            cookieName: 'adminjs_session',
            cookiePassword: 'super-long-secure-password-longer-than-32-chars-2026',
        }, null, { resave: false, saveUninitialized: true, secret: 'session_secret' });
        app.use(adminJs.options.rootPath, router);
        console.log(`[ADMIN] Панель управления инициализирована на /admin`);
    } catch (err) {
        console.error(`[ADMIN ERROR] Сбой запуска админки: ${err.message}`);
    }
};

// --- START ---
bot.start((ctx) => {
    console.log(`[BOT] Пользователь ${ctx.from.id} нажал /start`);
    ctx.reply(`<b>Neural Pulse | Sync Active</b>`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ ТЕРМИНАЛ", DOMAIN)]])
    });
});

const WEBHOOK_PATH = `/telegraf/${BOT_TOKEN}`;
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.listen(PORT, async () => {
    try {
        console.log(`[SERVER] Попытка подключения к БД...`);
        await sequelize.authenticate();
        console.log(`[SERVER] Подключение к БД успешно.`);
        
        await sequelize.sync({ alter: true });
        console.log(`[SERVER] Таблицы синхронизированы (alter mode).`);
        
        await startAdmin();
        
        console.log(`🚀 SERVER READY: ${DOMAIN}`);
        
        await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
        console.log(`[BOT] Webhook установлен на ${DOMAIN}${WEBHOOK_PATH}`);
    } catch (err) {
        console.error(`[CRITICAL ERROR] Ошибка при запуске сервера: ${err.message}`);
    }
});
