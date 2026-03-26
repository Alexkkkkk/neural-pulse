import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs'; 
import { createProxyMiddleware } from 'http-proxy-middleware';
import { User, Task, Stats } from './db.js';
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

// --- ВЕБХУК (Ставим первым, чтобы не блокировался другими запросами) ---
app.use(`/telegraf/${BOT_TOKEN}`, (req, res, next) => {
    // Telegraf обработает запрос, мы просто передаем управление
    return bot.webhookCallback(`/telegraf/${BOT_TOKEN}`)(req, res, next);
});

// --- НАСТРОЙКИ СЕРВЕРА ---
app.use(cors({ origin: '*' }));
app.use('/api', express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

// --- PROXY ДЛЯ АДМИНКИ ---
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    ws: true,
    proxyTimeout: 30000, 
    timeout: 30000,
    onError: (err, req, res) => {
        logger.warn(`Proxy missed AdminJS on 3001. Booting up...`);
        if (!res.headersSent) {
            res.status(502).set('Content-Type', 'text/html').send(`
                <div style="background:#05070a; color:#00f2fe; padding:40px; font-family: Courier New, monospace; border: 2px solid #00f2fe; max-width: 600px; margin: 50px auto; text-align: center;">
                    <h2>> NEURAL_PULSE: SYSTEM BOOT</h2>
                    <p style="color: #ff3366;">[!] ИНТЕРФЕЙС УПРАВЛЕНИЯ ЗАГРУЖАЕТСЯ</p>
                    <p>Сервер поднимает админ-панель. Подождите 10 секунд и обновите.</p>
                    <button onclick="location.reload()" style="background:#00f2fe; color:black; padding:10px; font-weight:bold; cursor:pointer;">ОБНОВИТЬ СОЕДИНЕНИЕ</button>
                </div>
            `);
        }
    }
}));

// --- БОТ ЛОГИКА ---
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
                photo_url = (await ctx.telegram.getFileLink(fileId)).href;
            }
        } catch (e) {}

        const [user, created] = await User.findOrCreate({ 
            where: { id: BigInt(userId) }, 
            defaults: { 
                username: ctx.from.username || 'AGENT',
                photo_url: photo_url,
                referred_by: (startPayload && !isNaN(startPayload)) ? BigInt(startPayload) : null
            } 
        });

        if (created && user.referred_by) {
            User.increment('referrals', { where: { id: user.referred_by } }).catch(e => logger.error(e));
        }

        const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]]);
        const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${ctx.from.username || userId}</code>\nСтатус: <b>ONLINE</b>`;

        if (fs.existsSync(logoPath)) {
            await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
        } else {
            await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
        }
    } catch (e) { 
        logger.error(`Bot Start Error`, e); 
        await ctx.reply("Система временно перегружена. Повторите запрос.").catch(()=>{});
    }
});

// --- API ---
app.get('/api/top', async (req, res) => {
    try {
        const top = await User.findAll({ limit: 50, order: [['balance', 'DESC']], raw: true });
        res.json(top);
    } catch (e) { res.status(500).json([]); }
});

app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        await User.update({ ...data, last_seen: new Date() }, { where: { id: BigInt(id) } });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "SAVE_ERROR" }); }
});

const server = app.listen(PORT, '0.0.0.0', () => {
    logger.system(`GATEWAY ONLINE: Port ${PORT}`);
});
