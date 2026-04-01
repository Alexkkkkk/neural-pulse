import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dayjs from 'dayjs';
import EventEmitter from 'events'; 
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';

// --- 🏛️ ADMINJS IMPORTS ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';

// Ядро данных
import { sequelize, User, Task, Stats, GlobalStats, initDB, Op } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Регистрация адаптера Sequelize для AdminJS
AdminJS.registerAdapter(AdminJSSequelize);

// --- 💠 СИНГУЛЯРНОСТЬ ВЫСШЕГО ПОРЯДКА ---
class GodCore extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(0);
    }
}
const core = new GodCore();

const neuralLog = (msg, type = 'INFO') => {
    const time = dayjs().format('HH:mm:ss.SSS');
    const icons = { 
        INFO: '💎', WARN: '⚠️', ERROR: '☢️', CORE: '🔮', 
        NET: '🛰️', SUCCESS: '🔋', ANTI_CHEAT: '⚔️', SYNC: '🧬', SHIELD: '🛡️', VOID: '⬛'
    };
    console.log(`${icons[type] || '▪️'} [${time}] ${msg}`);
};

// --- ⚙️ OMNI-CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN || "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;
const SECRET_SALT = process.env.SECRET_SALT || "ULTRA_SECRET_PULSE_2026_VOID";

const bot = new Telegraf(BOT_TOKEN);

// --- 🛡️ PROTOCOL "VOID AEGIS" ---
const shieldData = new Map(); 
const blackList = new Set(); 
const SHIELD_LIMIT = 100;
const updateBuffer = new Map();
let isSyncing = false;
let isCircuitOpen = false;

// --- 🧬 DELTA-SYNC ENGINE ---
const executeMassiveCommit = async () => {
    if (updateBuffer.size === 0 || isSyncing) return;
    isSyncing = true;
    const snapshot = Array.from(updateBuffer.values());
    updateBuffer.clear();
    const CHUNK_SIZE = 2500;

    for (let i = 0; i < snapshot.length; i += CHUNK_SIZE) {
        const chunk = snapshot.slice(i, i + CHUNK_SIZE);
        try {
            const ids = chunk.map(u => u.id);
            const cases = chunk.map(u => `WHEN id = ${u.id} THEN ${u.balance}`).join(' ');
            await sequelize.query(
                `UPDATE users SET balance = CASE ${cases} ELSE balance END, 
                updated_at = NOW() WHERE id IN (${ids.join(',')})`
            );
        } catch (e) {
            neuralLog(`🚨 SYNC ERROR: ${e.message}`, 'ERROR');
            isCircuitOpen = true;
        }
    }
    isSyncing = false;
};
setInterval(executeMassiveCommit, 3000);

// --- 🌐 API & ADMIN SETUP ---
async function setupSupremeInterface(app) {
    // 1. Настройка AdminJS
    const adminJs = new AdminJS({
        resources: [
            { resource: User, options: { navigation: { name: 'Users', icon: 'User' } } },
            { resource: Task, options: { navigation: { name: 'Quests', icon: 'List' } } },
            { resource: Stats, options: { navigation: { name: 'Analytics', icon: 'Activity' } } },
            { resource: GlobalStats, options: { navigation: { name: 'System', icon: 'Settings' } } }
        ],
        rootPath: '/admin',
        branding: {
            companyName: 'NEURAL PULSE OS',
            softwareBrochure: false,
            logo: '/static/images/logo.png', // Использует твой дизайн
            withMadeWithLove: false
        },
        bundler: { minify: true }
    });

    // Строим роутер для админки (БЕЗ авторизации для Bothost, или добавь её позже)
    const adminRouter = AdminJSExpress.buildRouter(adminJs);
    
    // ВАЖНО: Подключаем админку ДО статики и общих роутов
    app.use(adminJs.options.rootPath, adminRouter);

    // 2. API Роуты
    app.get('/health', (req, res) => {
        res.status(isCircuitOpen ? 503 : 200).json({ status: isCircuitOpen ? 'degraded' : 'perfect' });
    });

    app.post('/api/save', (req, res) => {
        const { id, balance, hash, nonce } = req.body;
        if (blackList.has(id)) return res.status(403).send("VOID");
        const check = crypto.createHmac('sha256', SECRET_SALT).update(`${id}:${balance}`).digest('hex');
        if (hash !== check) return res.status(403).send("SIGN_ERR");
        updateBuffer.set(id, { id, balance });
        res.json({ s: 1, node: "QUANTUM-X" });
    });

    app.get('/api/admin/stream', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const listener = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        core.on('broadcast', listener);
        req.on('close', () => core.removeListener('broadcast', listener));
    });
}

// --- 🤖 BOT SETUP ---
function setupBot(botInstance) {
    botInstance.start(async (ctx) => {
        try {
            const [user, created] = await User.findOrCreate({
                where: { id: ctx.from.id },
                defaults: { username: ctx.from.username || `AGENT_${ctx.from.id}`, balance: 0 }
            });
            if (created) await GlobalStats.increment('total_users', { where: { id: 1 } });

            ctx.replyWithHTML(
                `<b>─── [ NEURAL OS : OMNI ] ───</b>\n\n` +
                `Agent: <code>${user.username}</code>\n` +
                `Status: <b>V12 QUANTUM</b>\n\n` +
                `<i>Система готова к глобальному потоку данных.</i>`,
                Markup.inlineKeyboard([
                    [Markup.button.webApp("⚡ ТЕРМИНАЛ", `${DOMAIN}/static/index.html`)],
                    [Markup.button.url("🛰️ ТРАНСЛЯЦИЯ", "https://t.me/neural_pulse_news")]
                ])
            );
        } catch (e) { neuralLog(`Bot Error: ${e.message}`, 'ERROR'); }
    });
}

// --- 🚀 SUPREME LAUNCH SEQUENCE ---
async function startSupreme() {
    neuralLog('🔮 INITIALIZING OMNI-QUANTUM CORE...', 'CORE');
    const app = express();

    // Настройка безопасности и сжатия
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(compression({ level: 1 }));
    app.use(cors());
    app.use(express.json({ limit: '5kb' }));

    // Статика (Твой дизайн и лого)
    app.use('/static', express.static(path.join(__dirname, 'static'), { maxAge: '30d' }));

    try {
        await initDB();
        
        // Интеграция Админки и API
        await setupSupremeInterface(app);
        setupBot(bot);

        // Метрики для стрима
        setInterval(() => {
            core.emit('broadcast', {
                v: '12.0-OMNI',
                users: updateBuffer.size,
                ram: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)}MB`,
                load: os.loadavg()[0].toFixed(2)
            });
        }, 2000);

        // Webhook
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => bot.handleUpdate(req.body, res));
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);

        app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`👑 OMNI-QUANTUM ONLINE | PORT: ${PORT}`, 'SUCCESS');
            neuralLog(`🚀 ADMIN PANEL: ${DOMAIN}/admin`, 'SUCCESS');
        });
    } catch (err) {
        neuralLog(`🚨 SYSTEM FAIL: ${err.message}`, 'ERROR');
        process.exit(1);
    }
}

startSupreme();
