import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs'; 
import { createProxyMiddleware } from 'http-proxy-middleware';
import { sequelize, User, Task, Stats } from './db.js';
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

// --- [DIAGNOSTICS] ---
app.get('/debug-proxy', async (req, res) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        // Используем 127.0.0.1 для внутренней сети контейнера
        const response = await fetch('http://127.0.0.1:3001/admin/login', { 
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        res.json({ 
            status: 'success', 
            admin_port_3001: 'reachable', 
            http_code: response.status 
        });
    } catch (err) {
        res.json({ 
            status: 'error', 
            admin_port_3001: 'UNREACHABLE', 
            reason: err.message
        });
    }
});

// 1. ВЕБХУК (Ставим ПЕРЕД прокси)
app.use(bot.webhookCallback(`/telegraf/${BOT_TOKEN}`));

// 2. НАСТРОЙКИ
app.use(cors({ origin: '*' }));
app.use('/api', express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

// 3. [FIXED PROXY]
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    ws: true,
    xfwd: true,
    onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('host', 'localhost:3001');
    },
    onError: (err, req, res) => {
        logger.error(`[PROXY_FATAL] AdminJS offline.`);
        res.status(502).set('Content-Type', 'text/html').send(`
            <div style="background:#05070a; color:#00f2fe; padding:40px; font-family: monospace; border: 2px solid #00f2fe; max-width: 600px; margin: 50px auto; text-align: center;">
                <h2>> NEURAL_PULSE: ADMIN_OFFLINE</h2>
                <p style="color: #ff3366;">[!] СИСТЕМА ЕЩЕ ЗАГРУЖАЕТСЯ</p>
                <p>Админка собирает бандлы. Обновите через 30-60 секунд.</p>
                <button onclick="location.reload()" style="background:#00f2fe; color:black; padding:10px; cursor:pointer;">ОБНОВИТЬ</button>
            </div>
        `);
    }
}));

// --- ЛОГИКА БОТА ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const startPayload = ctx.payload; 
    const logoPath = path.join(__dirname, 'static/images/logo.png');
    
    try {
        let photo_url = null;
        try {
            const photos = await ctx.getUserProfilePhotos(userId, 0, 1);
            if (photos.total_count > 0) {
                const fileId = photos.photos[0][0].file_id;
                const link = await ctx.telegram.getFileLink(fileId);
                photo_url = link.href;
            }
        } catch (e) { }

        const [user, created] = await User.findOrCreate({ 
            where: { id: BigInt(userId) }, 
            defaults: { 
                username: ctx.from.username || 'AGENT',
                photo_url: photo_url,
                referred_by: (startPayload && !isNaN(startPayload) && startPayload !== userId.toString()) ? BigInt(startPayload) : null
            } 
        });

        if (created && user.referred_by) {
            await User.increment('referrals', { where: { id: user.referred_by } });
        }

        const keyboard = Markup.inlineKeyboard([[
            Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)
        ]]);

        const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${ctx.from.username || userId}</code>\nСтатус: <b>ONLINE</b>`;

        if (fs.existsSync(logoPath)) {
            await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
        } else {
            await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
        }
    } catch (e) { 
        logger.error(`Bot Start Error`, e);
    }
});

// --- API ---
app.get('/api/top', async (req, res) => {
    try {
        const topUsers = await User.findAll({ 
            limit: 50, order: [['balance', 'DESC']], 
            attributes: ['username', 'balance', 'level', 'photo_url'], raw: true 
        });
        res.json(topUsers);
    } catch (e) { res.status(500).json([]); }
});

app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        if (!id) return res.status(400).json({ error: "NO_ID" });
        await User.update({ ...data, last_seen: new Date() }, { where: { id: BigInt(id) } });
        res.json({ ok: true });
    } catch (e) { 
        res.status(500).json({ error: "SAVE_ERROR" }); 
    }
});

// ФИНАЛЬНЫЙ ЗАПУСК С ОБРАБОТКОЙ ОШИБОК ПОРТА
const startListening = () => {
    const server = app.listen(PORT, '0.0.0.0', () => {
        logger.system(`GATEWAY ONLINE: Port ${PORT}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger.error(`Port ${PORT} is busy. Retrying in 5s...`);
            setTimeout(() => {
                server.close();
                startListening();
            }, 5000);
        } else {
            logger.error('Server error:', err);
        }
    });

    const shutdown = async () => {
        server.close(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
};

startListening();
