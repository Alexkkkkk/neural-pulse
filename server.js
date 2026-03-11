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
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse";

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

const app = express();
app.set('trust proxy', 1);
const bot = new Telegraf(API_TOKEN);

bot.catch((err, ctx) => {
    logger.error(`❌ [TELEGRAF ERROR] ${ctx.updateType}: ${err.message}`);
});

let usersData = {};

// [3] БАЗА ДАННЫХ
function initDatabase() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            try {
                usersData = raw.trim() ? JSON.parse(raw) : {};
                logger.info(`📂 БД загружена: ${Object.keys(usersData).length} пользователей`);
            } catch (jsonErr) {
                logger.error("🚨 БД повреждена, сброс");
                usersData = {};
            }
        } else {
            fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
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

// [4] СЕТЬ
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

app.post(WEBHOOK_PATH, async (req, res) => {
    logger.debug(`📥 Webhook Update ID: ${req.body?.update_id}`);
    try {
        await bot.handleUpdate(req.body, res);
    } catch (e) {
        logger.error(`❌ [HANDLE ERROR] ${e.message}`);
        if (!res.headersSent) res.sendStatus(500);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ONLINE', users: Object.keys(usersData).length, uptime: Math.floor(process.uptime()) });
});

// [5] ЛОГИКА БОТА
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    try {
        await ctx.replyWithHTML(`🦾 <b>NEURAL PULSE ONLINE</b>`, 
            Markup.inlineKeyboard([[Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", `${WEB_APP_URL}/?u=${uid}`)]])
        );
    } catch (e) { logger.error(`❌ [START ERROR]: ${e.message}`); }
});

// API
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, last_seen: Date.now() };
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

// [6] ЗАПУСК СИСТЕМЫ (ПРИОРИТЕТ ВЕБХУКА)
async function boot() {
    initDatabase();
    
    logger.info("📡 Шаг 1: Принудительная установка вебхука...");
    try {
        const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
        
        // Удаляем старый и ставим новый вебхук ДО запуска сервера
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        await bot.telegram.setWebhook(hookUrl);
        
        const info = await bot.telegram.getWebhookInfo();
        logger.info(`🔗 Вебхук активен: ${info.url}`);

        // Шаг 2: Только теперь открываем порт
        logger.info("🌐 Шаг 2: Открытие порта для Bothost...");
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`✅ [SYSTEM ONLINE] Слушаю порт: ${PORT}`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.warn(`⚠️ Порт ${PORT} занят. Перезапуск через 3 сек для вытеснения...`);
                setTimeout(() => process.exit(1), 3000);
            }
        });

    } catch (e) {
        logger.error(`🛑 КРИТИЧЕСКИЙ СБОЙ: ${e.message}`);
        setTimeout(() => process.exit(1), 5000);
    }
}

const syncInterval = setInterval(saveData, 60000);
process.once('SIGINT', () => { clearInterval(syncInterval); saveData(); process.exit(0); });
process.once('SIGTERM', () => { clearInterval(syncInterval); saveData(); process.exit(0); });

boot();
