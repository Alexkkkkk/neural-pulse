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

// Ядро данных
import { sequelize, User, Stats, GlobalStats, sessionStore, initDB, Op } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 💠 СИНГУЛЯРНОСТЬ ВЫСШЕГО ПОРЯДКА ---
class GodCore extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(0);
    }
}
const core = new GodCore();

const ADMIN_ID = 485145717; 

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

const SHIELD_LIMIT = 100; // Порог для High-Load
const BAN_DURATION = 3600000; // 1 час за спам

let isCircuitOpen = false;

// Агрессивная очистка памяти для 20M+ профилей
setInterval(() => {
    shieldData.clear(); 
    if (isCircuitOpen) {
        isCircuitOpen = false;
        neuralLog('🛡️ CIRCUIT BREAKER: Auto-Reset active', 'CORE');
    }
}, 60000);

// --- 🧬 DELTA-SYNC ENGINE: MASSIVE SQL OPTIMIZATION ---
const updateBuffer = new Map();
let isSyncing = false;

const executeMassiveCommit = async () => {
    if (updateBuffer.size === 0 || isSyncing) return;
    isSyncing = true;
    
    const snapshot = Array.from(updateBuffer.values());
    updateBuffer.clear();

    const CHUNK_SIZE = 2500; // Оптимально для одного SQL пакета
    neuralLog(`🧬 SYNC: Processing ${snapshot.length} units`, 'SYNC');

    for (let i = 0; i < snapshot.length; i += CHUNK_SIZE) {
        const chunk = snapshot.slice(i, i + CHUNK_SIZE);
        
        try {
            // МАССОВОЕ ОБНОВЛЕНИЕ ЧЕРЕЗ CASE (В 100 раз быстрее циклов)
            const ids = chunk.map(u => u.id);
            const cases = chunk.map(u => `WHEN id = ${u.id} THEN ${u.balance}`).join(' ');
            
            await sequelize.query(
                `UPDATE Users SET balance = CASE ${cases} ELSE balance END, 
                updatedAt = NOW() WHERE id IN (${ids.join(',')})`
            );

            // Инкремент общего баланса (суммарно по чанку)
            const chunkDelta = chunk.reduce((sum, u) => sum + (u.delta || 0), 0);
            if (chunkDelta > 0) {
                await GlobalStats.increment('total_balance', { by: chunkDelta, where: { id: 1 } });
            }
        } catch (e) {
            neuralLog(`🚨 SYNC ERROR: ${e.message}`, 'ERROR');
            fs.appendFileSync('quantum_dump.json', JSON.stringify(chunk) + '\n');
            isCircuitOpen = true;
        }
    }
    isSyncing = false;
};

setInterval(executeMassiveCommit, 3000);

// --- 🌐 API SUPREME INTERFACE ---
function setupAPIRoutes(app) {
    app.get('/health', (req, res) => {
        res.status(isCircuitOpen ? 503 : 200).json({ 
            status: isCircuitOpen ? 'degraded' : 'perfect', 
            load: os.loadavg()[0].toFixed(2) 
        });
    });

    app.post('/api/save', (req, res) => {
        const { id, balance, hash, nonce } = req.body;

        if (blackList.has(id)) return res.status(403).send("VOID");

        // 1. Быстрая проверка подписи
        const check = crypto.createHmac('sha256', SECRET_SALT).update(`${id}:${balance}`).digest('hex');
        if (hash !== check) return res.status(403).send("SIGN_ERR");

        // 2. Shield Logic (Rate limit + Idempotency)
        let uData = shieldData.get(id) || { n: new Set(), r: 0 };
        if (uData.n.has(nonce)) return res.json({ s: 1, msg: "cached" });

        uData.r++;
        if (uData.r > SHIELD_LIMIT) {
            blackList.add(id);
            return res.status(429).send("LIMIT");
        }
        uData.n.add(nonce);
        shieldData.set(id, uData);

        // 3. Buffer Injection
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

// --- 🤖 BOT NEURAL SUPREME ---
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
                `Status: <b>V12 QUANTUM</b>\n` +
                `Capacity: <b>20M+ READY</b>\n\n` +
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

    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(compression({ level: 1 })); // Быстрое сжатие для High-Load
    app.use(cors());
    app.use(express.json({ limit: '1kb' }));

    app.use('/static', express.static(path.join(__dirname, 'static'), { maxAge: '30d' }));

    try {
        await initDB();
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { total_users: 0, total_balance: 0 } });
        
        setupAPIRoutes(app);
        setupBot(bot);

        // GOD VISION: Метрики
        setInterval(() => {
            core.emit('broadcast', {
                v: '12.0-OMNI',
                users: updateBuffer.size,
                ram: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)}MB`,
                load: os.loadavg()[0].toFixed(2)
            });
        }, 2000);

        // Webhook для масштабирования
        app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => bot.handleUpdate(req.body, res));
        await bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`, {
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: true
        });

        app.listen(PORT, '0.0.0.0', () => {
            neuralLog(`👑 OMNI-QUANTUM ONLINE | PORT: ${PORT}`, 'SUCCESS');
        });
    } catch (err) {
        neuralLog(`🚨 SYSTEM FAIL: ${err.message}`, 'ERROR');
        process.exit(1);
    }
}

startSupreme();
