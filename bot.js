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

// --- [DIAGNOSTICS] Эндпоинт для проверки доступности админки изнутри ---
app.get('/debug-proxy', async (req, res) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch('http://127.0.0.1:3001/admin/login', { signal: controller.signal });
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

// 1. ВЕБХУК
app.use(bot.webhookCallback(`/telegraf/${BOT_TOKEN}`));

// 2. НАСТРОЙКИ
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'static')));

// 3. [FULL DIAGNOSTIC PROXY]
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    ws: true,
    // Включаем подробное логирование прокси
    onProxyReq: (proxyReq, req, res) => {
        logger.info(`[PROXY_REQ] ${req.method} ${req.url} -> AdminJS`);
    },
    onProxyRes: (proxyRes, req, res) => {
        if (proxyRes.statusCode >= 400) {
            logger.warn(`[PROXY_RES] AdminJS вернул статус: ${proxyRes.statusCode} для ${req.url}`);
        }
    },
    onError: (err, req, res) => {
        logger.error(`[PROXY_FATAL] Ошибка соединения с AdminJS на порту 3001!`);
        logger.error(`Детали: ${err.stack}`);
        
        res.status(502).set('Content-Type', 'text/html').send(`
            <div style="background:#0a0a0a; color:#00ffcc; padding:30px; font-family: 'Courier New', monospace; border: 1px solid #00ffcc; border-radius: 8px; max-width: 600px; margin: 50px auto; box-shadow: 0 0 20px rgba(0,255,204,0.2);">
                <h2 style="border-bottom: 1px solid #00ffcc; padding-bottom: 10px;">> NEURAL_PULSE: PROXY_ERROR</h2>
                <p style="color: #ff3366;">[!] STATUS: ADMIN_PANEL_OFFLINE</p>
                <p>Возможные причины:</p>
                <ul style="line-height: 1.6;">
                    <li>Файл <b>admin.js</b> еще не закончил сборку фронтенда.</li>
                    <li>Процесс на порту <b>3001</b> упал или не запустился.</li>
                    <li>Ошибка инициализации базы данных в админке.</li>
                </ul>
                <p style="font-size: 0.8em; color: #666;">Техническая ошибка: ${err.message}</p>
                <button onclick="location.reload()" style="background: transparent; border: 1px solid #00ffcc; color: #00ffcc; padding: 10px 20px; cursor: pointer; margin-top: 10px;">ПОПЫТКА_ПЕРЕПОДКЛЮЧЕНИЯ</button>
            </div>
        `);
    }
}));

// --- ЛОГИКА БОТА ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const startPayload = ctx.payload; 
    const logoPath = path.join(__dirname, 'static/images/logo.png');
    
    logger.info(`[CORE] /start для: ${userId}`);

    try {
        let photo_url = null;
        try {
            const photos = await ctx.getUserProfilePhotos(userId, 0, 1);
            if (photos.total_count > 0) {
                const fileId = photos.photos[0][0].file_id;
                const link = await ctx.telegram.getFileLink(fileId);
                photo_url = link.href;
            }
        } catch (e) { logger.warn(`[CORE] Нет фото для ${userId}`); }

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
            logger.info(`[REF] Агент ${userId} прикреплен к ${user.referred_by}`);
        }

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
        logger.error('Save API Error:', e);
        res.status(500).json({ error: "SAVE_ERROR" }); 
    }
});

const server = app.listen(PORT, '0.0.0.0', () => {
    logger.system(`GATEWAY ONLINE: Port ${PORT}`);
    logger.info(`Diagnostic tool available at: ${DOMAIN}/debug-proxy`);
});

const shutdown = async () => {
    server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
