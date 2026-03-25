import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { sequelize, User, Stats } from './db.js'; // Подключаем общую БД

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const logger = {
    info: (msg) => console.log(`[BOT] 🔵 INFO: ${msg}`),
    error: (msg, err) => console.error(`[BOT] 🔴 ERROR: ${msg}`, err),
    http: (req, res, next) => {
        const start = Date.now();
        if (req.url.startsWith('/api')) {
            res.on('finish', () => console.log(`[BOT] 🟢 API ${req.method} ${req.url} ${res.statusCode} | ${Date.now() - start}ms`));
        }
        next();
    }
};

app.disable('x-powered-by'); 
app.set('trust proxy', 1);
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(logger.http); 
app.use(express.static(path.join(__dirname, 'static')));

// --- API ROUTES ---
app.get('/api/top', async (req, res) => {
    try {
        const topUsers = await User.findAll({ limit: 50, order: [['balance', 'DESC']], attributes: ['username', 'balance', 'level', 'photo_url'], raw: true });
        res.json(topUsers);
    } catch (e) { res.status(500).json([]); }
});

app.get('/api/user/:id', async (req, res) => {
    try {
        const userId = BigInt(req.params.id);
        let user = await User.findByPk(userId);
        if (!user) user = await User.create({ id: userId, username: req.query.username || 'AGENT' });
        res.json(user);
    } catch (e) { res.status(500).json({ error: "CORE_ERROR" }); }
});

app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        if (data.balance !== undefined) {
            const b = data.balance;
            data.level = b < 50000 ? 1 : b < 500000 ? 2 : 3;
        }
        await User.update({ ...data, last_seen: new Date() }, { where: { id: BigInt(id) } });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "SAVE_ERROR" }); }
});

// --- TELEGRAM BOT ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const logoPath = path.join(__dirname, 'static/images/logo.png');
    try {
        let user = await User.findByPk(userId);
        if (!user) user = await User.create({ id: userId, username: ctx.from.username || 'AGENT' });
        ctx.replyWithPhoto({ source: logoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nИдентификация пройдена.\nАгент: <code>${ctx.from.username || userId}</code>`,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]])
        });
    } catch (e) { logger.error(`Bot Error`, e); }
});

app.use(bot.webhookCallback(`/telegraf/${BOT_TOKEN}`));

// --- AUTO-STATS ---
setInterval(async () => {
    try {
        const startDb = Date.now();
        await sequelize.query('SELECT 1');
        await Stats.create({
            user_count: await User.count(),
            server_load: (os.loadavg()[0] * 10).toFixed(1),
            mem_usage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
            db_latency: Date.now() - startDb
        });
    } catch (e) {}
}, 30 * 60 * 1000);

// Инициализация Бота
app.listen(PORT, '0.0.0.0', async () => {
    logger.info("ENGINE STATUS: ONLINE (Port 3000)");
    await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);
    logger.info("Telegram Webhook: LINKED");
});
