import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import os from 'os';
import OpenAI from 'openai';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { sequelize, User, Stats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;
const OPENAI_KEY = "твой_ключ_здесь"; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const openai = new OpenAI({ apiKey: OPENAI_KEY });

app.disable('x-powered-by'); 
app.set('trust proxy', 1);
app.use(cors({ origin: '*' }));

// Прокси для AdminJS на 3001 порт
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    ws: true,
    logLevel: 'silent'
}));

app.use(express.json({ limit: '1mb' }));
if (logger.http) app.use(logger.http); 

app.use(express.static(path.join(__dirname, 'static')));

app.get('/api/top', async (req, res) => {
    try {
        const topUsers = await User.findAll({ 
            limit: 50, order: [['balance', 'DESC']], 
            attributes: ['username', 'balance', 'level', 'photo_url'], raw: true 
        });
        res.json(topUsers);
    } catch (e) { res.status(500).json([]); }
});

app.get('/api/user/:id', async (req, res) => {
    try {
        const userId = BigInt(req.params.id);
        let user = await User.findByPk(userId);
        if (!user) {
            user = await User.create({ id: userId, username: req.query.username || 'AGENT' });
        }
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

setInterval(async () => {
    try {
        const startDb = Date.now();
        await sequelize.query('SELECT 1');
        const dbLatency = Date.now() - startDb;
        await Stats.create({
            user_count: await User.count(),
            server_load: (os.loadavg()[0] * 10).toFixed(1),
            mem_usage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
            db_latency: dbLatency
        });
    } catch (e) { logger.warn("Failed to save auto-stats"); }
}, 15 * 60 * 1000); 

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const logoPath = path.join(__dirname, 'static/images/logo.png');
    try {
        let user = await User.findByPk(userId);
        if (!user) {
            user = await User.create({ id: userId, username: ctx.from.username || 'AGENT' });
        }
        const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]]);
        await ctx.replyWithPhoto({ source: logoPath }, {
            caption: `<b>Neural Pulse | Terminal</b>\n\nИдентификация пройдена.\nАгент: <code>${ctx.from.username || userId}</code>\nСтатус: <b>ONLINE</b>`,
            parse_mode: 'HTML', ...keyboard
        });
    } catch (e) { 
        logger.error(`Bot Start Error`, e);
        ctx.reply("⚠️ Ошибка инициализации терминала.");
    }
});

app.use(bot.webhookCallback(`/telegraf/${BOT_TOKEN}`));

const server = app.listen(PORT, '0.0.0.0', () => {
    logger.system(`API & BOT: ACTIVE on port ${PORT}`);
    logger.info(`Admin Proxy: ${DOMAIN}/admin -> PORT 3001`);
});

const shutdown = async () => {
    logger.warn("Bot core shutdown signal received");
    server.close(() => {
        logger.info("Process terminated safely.");
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
