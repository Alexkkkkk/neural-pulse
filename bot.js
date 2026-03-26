import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs'; 
import { createProxyMiddleware } from 'http-proxy-middleware';
import { sequelize, User, Stats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.disable('x-powered-by'); 
app.set('trust proxy', 1);

// --- ДИАГНОСТИКА: ВИДИМ ЛИ МЫ ТРАФИК? ---
app.use((req, res, next) => {
    if (req.url.includes('telegraf')) {
        logger.info(`[NETWORK] Incoming Webhook POST: ${req.url} from ${req.ip}`);
    }
    next();
});

// 1. ОБРАБОТЧИК ВЕБХУКА (САМЫЙ ПЕРВЫЙ)
app.use(bot.webhookCallback(`/telegraf/${BOT_TOKEN}`));

// 2. ОСТАЛЬНЫЕ НАСТРОЙКИ
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'static')));

// 3. ПРОКСИ ДЛЯ ADMINJS
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    ws: true,
    logLevel: 'error',
    onError: (err, req, res) => {
        logger.error('Proxy Error:', err);
        res.status(502).send('Admin Panel is starting...');
    }
}));

// --- ЛОГИКА БОТА ---
bot.use(async (ctx, next) => {
    logger.info(`--- [TELEGRAM] Обновление: ${ctx.updateType} ---`);
    try {
        await next();
    } catch (err) {
        logger.error(`Update Error:`, err);
    }
});

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const logoPath = path.join(__dirname, 'static/images/logo.png');
    
    logger.info(`[CORE] /start для: ${userId}`);

    try {
        await User.findOrCreate({ 
            where: { id: BigInt(userId) }, 
            defaults: { username: ctx.from.username || 'AGENT' } 
        });

        const keyboard = Markup.inlineKeyboard([[
            Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)
        ]]);

        const caption = `<b>Neural Pulse | Terminal</b>\n\nИдентификация пройдена.\nАгент: <code>${ctx.from.username || userId}</code>\nСтатус: <b>ONLINE</b>`;

        if (fs.existsSync(logoPath)) {
            await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
        } else {
            await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
        }
    } catch (e) { 
        logger.error(`Bot Start Error`, e);
    }
});

// --- API ЭНДПОИНТЫ ---
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
        if (!id) return res.status(400).json({ error: "NO_ID" });

        if (data.balance !== undefined) {
            const b = data.balance;
            data.level = b < 50000 ? 1 : b < 500000 ? 2 : 3;
        }
        
        await User.update({ ...data, last_seen: new Date() }, { where: { id: BigInt(id) } });
        res.json({ ok: true });
    } catch (e) { 
        logger.error('Save API Error:', e);
        res.status(500).json({ error: "SAVE_ERROR" }); 
    }
});

// --- ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК EXPRESS ---
app.use((err, req, res, next) => {
    logger.error('Express Error:', err);
    res.status(500).send('Internal Server Error');
});

const server = app.listen(PORT, '0.0.0.0', () => {
    logger.system(`GATEWAY ONLINE: Port ${PORT}`);
    logger.info(`Proxying /admin -> 3001`);
});

const shutdown = async () => {
    logger.warn('Shutting down server...');
    server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
