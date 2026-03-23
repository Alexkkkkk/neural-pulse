import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { Sequelize, DataTypes } from 'sequelize';

// --- ИМПОРТЫ АДМИНКИ ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Регистрация адаптера Sequelize
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
    secret: 'neural_pulse_fix_2026',
    resave: false,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'static')));

// Пул для API
const pool = new Pool({ connectionString: PG_URI, ssl: false });

// Инициализация Sequelize для Админки
const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false,
    dialectOptions: { ssl: false } 
});

// Описание модели User для AdminJS
const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primary_key: true, autoIncrement: false },
    username: { type: DataTypes.STRING },
    balance: { type: DataTypes.DOUBLE, defaultValue: 0 },
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    profit: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false });

// --- ИНИЦИАЛИЗАЦИЯ БД ---
const initDB = async () => {
    try {
        console.log("🛠 [DB] Синхронизация через Sequelize...");
        await sequelize.authenticate();
        await sequelize.sync(); 
        console.log("✅ [DB] Таблицы готовы");
    } catch (e) {
        console.error("❌ [DB ERROR]:", e.message);
    }
};

// --- ЗАПУСК АДМИНКИ ---
const startAdmin = async () => {
    try {
        const adminJs = new AdminJS({
            resources: [
                { 
                    resource: User, 
                    options: { 
                        navigation: { name: 'Игроки', icon: 'User' },
                        properties: { id: { isId: true } }
                    } 
                }
            ],
            rootPath: '/admin',
            branding: { companyName: 'Neural Pulse Admin', softwareBrothers: false }
        });

        const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
            authenticate: async (email, password) => {
                if (email === 'admin@pulse.com' && password === 'Kander3132001574') return { email };
                return null;
            },
            cookieName: 'adminjs_session',
            cookiePassword: 'super-long-secure-password-longer-than-32-chars',
        }, null, { resave: false, saveUninitialized: true, secret: 'session_secret' });

        app.use(adminJs.options.rootPath, router);
        console.log(`✅ [ADMIN] Админка на Sequelize успешно запущена!`);
    } catch (e) { 
        console.error("❌ [ADMIN ERROR]:", e.message); 
    }
};

// --- API ---
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            const { username } = req.query;
            const newUser = await pool.query(`INSERT INTO users (id, username) VALUES ($1, $2) RETURNING *`, [userId, username || 'Agent']);
            return res.json(newUser.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, tap, profit } = req.body;
    try {
        await pool.query(
            `UPDATE users SET balance=$2, energy=$3, tap=$4, profit=$5, last_seen=NOW() WHERE id=$1`, 
            [userId, balance, energy, tap, profit]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Save error" }); }
});

// --- BOT ---
bot.start((ctx) => {
    ctx.reply(`<b>Neural Pulse | Terminal</b>`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ЗАПУСТИТЬ", DOMAIN)]])
    });
});

app.use(bot.webhookCallback(`/telegraf/${BOT_TOKEN}`));

app.listen(PORT, async () => {
    await initDB();
    await startAdmin();
    console.log(`🚀 [SERVER] Запущен на ${DOMAIN}`);
    await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);
});
