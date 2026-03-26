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

// --- [SUPREME NEURAL DIAGNOSTICS HUD] ---
app.get('/api/health', async (req, res) => {
    const start = Date.now();
    let adminStatus = 'OFFLINE', dbStatus = 'OFFLINE', botApi = 'ERROR';
    
    // 1. Проверка Базы Данных
    try { 
        await sequelize.authenticate(); 
        dbStatus = 'STABLE'; 
    } catch(e) { dbStatus = 'CRITICAL'; }

    // 2. Проверка Админки (Порт 3001)
    try { 
        const aRes = await fetch('http://127.0.0.1:3001/admin', { method: 'HEAD' });
        adminStatus = aRes.ok ? 'OPERATIONAL' : 'BUNDLING...';
    } catch(e) { adminStatus = 'STARTING'; }

    // 3. Проверка API Бота
    try { 
        const count = await User.count();
        botApi = count >= 0 ? 'ONLINE' : 'ERR'; 
    } catch(e) { botApi = 'OFFLINE'; }

    const latency = Date.now() - start;
    const mem = process.memoryUsage();
    const load = os.loadavg()[0] * 10; // Примерная нагрузка в %

    res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>NP_CORE_DIAGNOSTICS</title>
        <style>
            body { background: #05070a; color: #00f2fe; font-family: 'Courier New', monospace; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .hud { border: 2px solid #00f2fe; padding: 25px; width: 100%; max-width: 500px; box-shadow: 0 0 20px rgba(0, 242, 254, 0.15); background: rgba(0, 242, 254, 0.02); position: relative; }
            .scanline { position: absolute; width: 100%; height: 2px; background: rgba(0, 242, 254, 0.1); top: 0; left: 0; animation: scan 4s linear infinite; }
            @keyframes scan { from { top: 0; } to { top: 100%; } }
            h2 { border-bottom: 1px solid #00f2fe; padding-bottom: 10px; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 2px; font-size: 18px; }
            .row { display: flex; justify-content: space-between; margin: 12px 0; font-size: 14px; }
            .ok { color: #33ff66; text-shadow: 0 0 8px #33ff66; font-weight: bold; }
            .warn { color: #ff3366; text-shadow: 0 0 8px #ff3366; animation: blink 0.8s infinite; font-weight: bold; }
            @keyframes blink { 50% { opacity: 0.3; } }
            .bar-bg { width: 120px; height: 12px; border: 1px solid #00f2fe; background: #111; position: relative; }
            .bar-fill { height: 100%; background: #00f2fe; box-shadow: 0 0 10px #00f2fe; width: ${Math.min(load, 100)}%; }
            .footer { margin-top: 25px; font-size: 10px; color: rgba(0, 242, 254, 0.4); text-align: right; }
        </style>
        <script>setTimeout(() => location.reload(), 3000);</script>
    </head>
    <body>
        <div class="hud">
            <div class="scanline"></div>
            <h2>> SYSTEM_DIAG_V2</h2>
            <div class="row"><span>CORE_DATABASE</span><span class="${dbStatus === 'STABLE' ? 'ok' : 'warn'}">${dbStatus}</span></div>
            <div class="row"><span>ADMIN_PANEL</span><span class="${adminStatus === 'OPERATIONAL' ? 'ok' : 'warn'}">${adminStatus}</span></div>
            <div class="row"><span>BOT_GATEWAY</span><span class="ok">${botApi}</span></div>
            <div class="row"><span>SIGNAL_LATENCY</span><span class="ok">${latency}ms</span></div>
            <hr style="border: 0; border-top: 1px solid rgba(0, 242, 254, 0.2); margin: 20px 0;">
            <div class="row"><span>CPU_LOAD_NODE</span><span>${load.toFixed(1)}% <div class="bar-bg" style="display:inline-block; vertical-align:middle; margin-left:10px;"><div class="bar-fill"></div></div></span></div>
            <div class="row"><span>MEMORY_RSS</span><span>${(mem.rss / 1024 / 1024).toFixed(1)} MB</span></div>
            <div class="row"><span>PROCESS_UPTIME</span><span>${(process.uptime() / 60).toFixed(1)} MIN</span></div>
            <div class="footer">NODE_ID: BOTH_NL4_PULSE | TIME: ${new Date().toLocaleTimeString()}</div>
        </div>
    </body></html>
    `);
});

// 1. ВЕБХУК
app.post(`/telegraf/${BOT_TOKEN}`, express.json(), (req, res) => {
    res.sendStatus(200); 
    bot.handleUpdate(req.body);
});

// 2. НАСТРОЙКИ
app.use(cors({ origin: '*' }));
app.use('/api', express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'static')));

// 3. УМНЫЙ ПРОКСИ
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    ws: true,
    onError: (err, req, res) => {
        res.status(502).set('Content-Type', 'text/html').send(`
            <div style="background:#05070a; color:#00f2fe; padding:40px; font-family: monospace; border: 2px solid #00f2fe; text-align: center; margin: 50px;">
                <h2>> SYSTEM_LOAD: BUNDLING_INTERFACE</h2>
                <p style="color: #ff3366;">[!] АДМИН-ПАНЕЛЬ В ПРОЦЕССЕ СБОРКИ</p>
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
        const [user] = await User.findOrCreate({ 
            where: { id: BigInt(userId) }, 
            defaults: { username: ctx.from.username || 'AGENT' } 
        });
        const keyboard = Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]]);
        const caption = `<b>Neural Pulse | Terminal</b>\n\nАгент: <code>${user.username}</code>\nСтатус: <b>ONLINE</b>`;
        
        if (fs.existsSync(logoPath)) {
            await ctx.replyWithPhoto({ source: logoPath }, { caption, parse_mode: 'HTML', ...keyboard });
        } else {
            await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
        }
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
