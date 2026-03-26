import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs'; 
import os from 'os';
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

// --- [ULTIMATE SELF-DIAGNOSTICS HUD] ---
app.get('/api/health', async (req, res) => {
    const start = Date.now();
    let adminStatus = 'OFFLINE', dbStatus = 'OFFLINE', botApi = 'ERROR';
    
    try { await sequelize.authenticate(); dbStatus = 'STABLE'; } catch(e) { dbStatus = 'CRITICAL'; }
    try { 
        const aRes = await fetch('http://127.0.0.1:3001/admin', { method: 'HEAD' });
        adminStatus = aRes.ok ? 'OPERATIONAL' : 'BUNDLING...';
    } catch(e) { adminStatus = 'STARTING'; }
    try { botApi = (await User.count()) >= 0 ? 'ONLINE' : 'ERR'; } catch(e) { botApi = 'OFFLINE'; }

    const latency = Date.now() - start;
    const mem = process.memoryUsage();
    const load = os.loadavg()[0] * 10;

    res.send(`
    <html>
    <head>
        <title>NP_CORE_DIAG</title>
        <style>
            body { background: #05070a; color: #00f2fe; font-family: 'Courier New', monospace; padding: 20px; overflow: hidden; }
            .hud { border: 1px solid #00f2fe; padding: 20px; box-shadow: 0 0 15px rgba(0, 242, 254, 0.2); position: relative; }
            .scan { position: absolute; width: 100%; height: 2px; background: rgba(0, 242, 254, 0.1); top: 0; animation: s 3s linear infinite; }
            @keyframes s { to { top: 100%; } }
            .row { display: flex; justify-content: space-between; margin: 8px 0; border-bottom: 1px dashed #111; }
            .ok { color: #33ff66; text-shadow: 0 0 5px #33ff66; }
            .warn { color: #ff3366; animation: b 0.5s infinite; }
            @keyframes b { 50% { opacity: 0; } }
            .bar { width: 100px; height: 10px; border: 1px solid #00f2fe; display: inline-block; }
            .fill { height: 100%; background: #00f2fe; width: ${Math.min(load, 100)}%; }
        </style>
        <script>setTimeout(() => location.reload(), 3000);</script>
    </head>
    <body>
        <div class="hud">
            <div class="scan"></div>
            <h2 style="margin:0">> NEURAL_PULSE_SYSTEM_OS</h2>
            <div class="row"><span>DB_NODE</span><span class="${dbStatus === 'STABLE' ? 'ok' : 'warn'}">${dbStatus}</span></div>
            <div class="row"><span>ADMIN_INTERFACE</span><span class="${adminStatus === 'OPERATIONAL' ? 'ok' : 'warn'}">${adminStatus}</span></div>
            <div class="row"><span>BOT_LOGIC_API</span><span class="ok">${botApi}</span></div>
            <div class="row"><span>LATENCY</span><span class="ok">${latency}ms</span></div>
            <br>
            <div class="row"><span>CPU_USAGE</span><span>${load.toFixed(1)}% <div class="bar"><div class="fill"></div></div></span></div>
            <div class="row"><span>RAM_RSS</span><span>${(mem.rss / 1024 / 1024).toFixed(1)}MB</span></div>
            <div class="row"><span>UPTIME</span><span>${(process.uptime() / 60).toFixed(1)}m</span></div>
            <div style="font-size:10px; color:#444; margin-top:10px;">NODE_ID: BOTH_NL4_PULSE | ${new Date().toLocaleTimeString()}</div>
        </div>
    </body></html>
    `);
});

// 1. ВЕБХУК (Мгновенное подтверждение для Bothost)
app.post(`/telegraf/${BOT_TOKEN}`, express.json(), (req, res) => {
    res.sendStatus(200); 
    bot.handleUpdate(req.body);
});

// 2. НАСТРОЙКИ
app.use(cors({ origin: '*' }));
app.use('/api', express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'static')));

// 3. УМНЫЙ ПРОКСИ (С обработкой ожидания)
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    ws: true,
    onError: (err, req, res) => {
        res.status(502).set('Content-Type', 'text/html').send(`
            <div style="background:#05070a; color:#00f2fe; padding:40px; font-family: monospace; border: 2px solid #00f2fe; text-align: center; margin: 50px;">
                <h2>> SYSTEM_LOAD: BUNDLING_INTERFACE</h2>
                <p style="color: #ff3366;">[!] АДМИН-ПАНЕЛЬ СОБИРАЕТСЯ</p>
                <p>Обычно это занимает 40-60 секунд. Пожалуйста, подождите.</p>
                <script>setTimeout(() => location.reload(), 5000);</script>
            </div>
        `);
    }
}));

// --- ЛОГИКА БОТА ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const logoPath = path.join(__dirname, 'static/images/logo.png');
    try {
        const [user, created] = await User.findOrCreate({ 
            where: { id: BigInt(userId) }, 
            defaults: { username: ctx.from.username || 'AGENT' } 
        });
        const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]]);
        const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${user.username}</code>\nСтатус: <b>ONLINE</b>`;
        if (fs.existsSync(logoPath)) await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
        else await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
    } catch (e) { logger.error(`Bot Start Error: ${e.message}`); }
});

// --- API ---
app.get('/api/top', async (req, res) => {
    try {
        const top = await User.findAll({ limit: 50, order: [['balance', 'DESC']], raw: true });
        res.json(top);
    } catch (e) { res.status(500).json([]); }
});

app.listen(PORT, '0.0.0.0', () => {
    logger.system(`ШЛЮЗ АКТИВИРОВАН: Port ${PORT}`);
});
