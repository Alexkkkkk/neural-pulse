import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs'; 
import os from 'os';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { sequelize, User } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN;
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// --- HUD САМОДИАГНОСТИКА ---
app.get('/api/health', async (req, res) => {
    const start = Date.now();
    let adminStatus = 'OFFLINE', dbStatus = 'OFFLINE';
    
    try { await sequelize.authenticate(); dbStatus = 'STABLE'; } catch(e) { dbStatus = 'CRITICAL'; }
    try {
        const aRes = await fetch('http://127.0.0.1:3001/admin', { method: 'HEAD' });
        adminStatus = aRes.ok ? 'OPERATIONAL' : 'BUNDLING...';
    } catch(e) { adminStatus = 'LOADING'; }

    const mem = process.memoryUsage();
    const load = os.loadavg()[0] * 10;

    res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8"><title>NP_DIAGNOSTICS</title>
        <style>
            body { background: #05070a; color: #00f2fe; font-family: monospace; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .hud { border: 2px solid #00f2fe; padding: 25px; width: 400px; box-shadow: 0 0 20px rgba(0, 242, 254, 0.2); background: rgba(0, 242, 254, 0.02); }
            h2 { border-bottom: 1px solid #00f2fe; padding-bottom: 10px; font-size: 16px; }
            .row { display: flex; justify-content: space-between; margin: 10px 0; font-size: 13px; }
            .ok { color: #33ff66; text-shadow: 0 0 5px #33ff66; }
            .warn { color: #ff3366; animation: blink 1s infinite; }
            @keyframes blink { 50% { opacity: 0.3; } }
        </style>
        <script>setTimeout(() => location.reload(), 3000);</script>
    </head>
    <body>
        <div class="hud">
            <h2>> SYSTEM_DIAG_V2</h2>
            <div class="row"><span>DATABASE</span><span class="${dbStatus === 'STABLE' ? 'ok' : 'warn'}">${dbStatus}</span></div>
            <div class="row"><span>ADMIN_PANEL</span><span class="${adminStatus === 'OPERATIONAL' ? 'ok' : 'warn'}">${adminStatus}</span></div>
            <div class="row"><span>CPU_LOAD</span><span>${load.toFixed(1)}%</span></div>
            <div class="row"><span>MEM_RSS</span><span>${(mem.rss / 1024 / 1024).toFixed(1)} MB</span></div>
            <div class="row"><span>LATENCY</span><span>${Date.now() - start}ms</span></div>
        </div>
    </body></html>`);
});

// --- TELEGRAM WEBHOOK ---
app.post(`/telegraf/${BOT_TOKEN}`, express.json(), (req, res) => {
    res.sendStatus(200);
    bot.handleUpdate(req.body).catch(err => logger.error(`[BOT_ERR] ${err.message}`));
});

app.use(cors({ origin: '*' }));
app.use('/api', express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'static')));

// --- ADMIN PROXY ---
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    ws: true,
    onError: (err, req, res) => {
        res.status(502).send('<body style="background:#05070a;color:#00f2fe;font-family:monospace;padding:50px;text-align:center;"><h2>> BUNDLING_INTERFACE...</h2><script>setTimeout(()=>location.reload(),5000)</script></body>');
    }
}));

// --- BOT LOGIC ---
bot.start(async (ctx) => {
    const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ТЕРМИНАЛ", DOMAIN)]]);
    try {
        await User.findOrCreate({ where: { id: BigInt(ctx.from.id) }, defaults: { username: ctx.from.username || 'AGENT' } });
        const logo = path.join(__dirname, 'static/images/logo.png');
        if (fs.existsSync(logo)) {
            await ctx.replyWithPhoto({ source: logo }, { caption: `<b>Neural Pulse</b>\nАгент: <code>${ctx.from.username}</code>`, parse_mode: 'HTML', ...keyboard });
        } else {
            await ctx.reply(`<b>Neural Pulse</b>\nАгент: <code>${ctx.from.username}</code>`, { parse_mode: 'HTML', ...keyboard });
        }
    } catch (e) { logger.error(`Bot Error: ${e.message}`); }
});

app.listen(PORT, () => logger.system(`ШЛЮЗ АКТИВИРОВАН: Port ${PORT}`));
