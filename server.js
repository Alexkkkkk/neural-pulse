const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// [1] ЛОГИРОВАНИЕ
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss.SSS' }), 
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()} > ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

// [2] КОНФИГУРАЦИЯ
const API_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const WEB_APP_URL = "https://np.bothost.ru"; // Твой домен на BotHost
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse";

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

const app = express();
app.set('trust proxy', 1);
const bot = new Telegraf(API_TOKEN);

let usersData = {};

// [3] БАЗА ДАННЫХ
function initDatabase() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            logger.info(`📂 БД загружена: ${Object.keys(usersData).length} пользователей`);
        } else {
            usersData = {};
            saveData();
        }
    } catch (e) { logger.error(`🚨 [DB INIT ERROR] ${e.message}`); }
}

function saveData() {
    try {
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(usersData, null, 2));
        fs.renameSync(tmp, DATA_FILE); 
    } catch (e) { logger.error(`💾 [SAVE ERROR] ${e.message}`); }
}

// [4] СЕТЬ И MIDDLEWARE
app.use(express.json());
app.use(cors());

// ВАЖНО: Согласно мануалу BotHost, статика должна быть в папке /public
app.use(express.static(path.join(__dirname, 'public')));

// Вебхук
app.post(WEBHOOK_PATH, async (req, res) => {
    try {
        await bot.handleUpdate(req.body, res);
    } catch (e) {
        logger.error(`❌ [HANDLE ERROR] ${e.message}`);
        if (!res.headersSent) res.sendStatus(500);
    }
});

// [5] ЛОГИКА БОТА
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    if (!usersData[uid]) {
        usersData[uid] = { 
            id: uid, 
            balance: 0, 
            energy: 1000, 
            max_energy: 1000,
            click_lvl: 1, 
            pnl: 0, 
            last_seen: Date.now() 
        };
        saveData();
    }
    
    await ctx.replyWithHTML(`🦾 <b>NEURAL PULSE ONLINE</b>\n\nДобро пожаловать в систему.`, 
        Markup.inlineKeyboard([[
            Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", `${WEB_APP_URL}/?u=${uid}`)
        ]])
    );
});

// API ДЛЯ ИГРЫ
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1, pnl: 0, last_seen: Date.now() };
        saveData(); 
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    
    if (uid && usersData[uid]) {
        usersData[uid].balance = Number(score);
        usersData[uid].energy = Number(energy);
        usersData[uid].last_seen = Date.now();
        saveData(); 
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// [6] ЗАПУСК
async function boot() {
    initDatabase();
    
    logger.info("📡 Шаг 1: Принудительный Вебхук...");
    try {
        const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        await bot.telegram.setWebhook(hookUrl);
        
        logger.info("🌐 Шаг 2: Запуск сервера (0.0.0.0)...");
        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`✅ [SYSTEM ONLINE] Port: ${PORT}`);
        });
    } catch (e) {
        logger.error(`🛑 КРИТИЧЕСКИЙ СБОЙ: ${e.message}`);
        setTimeout(() => process.exit(1), 5000);
    }
}

// Авто-сохранение и корректный выход
const syncInterval = setInterval(saveData, 60000);
const shutdown = () => { clearInterval(syncInterval); saveData(); process.exit(0); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

boot();
