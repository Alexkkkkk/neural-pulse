const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// [1] ЛОГИРОВАНИЕ (Расширенное)
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
app.use(express.static(path.join(__dirname, 'static')));

// Обработка вебхука Telegram
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
    // Регистрируем пользователя сразу при команде /start
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
    
    await ctx.replyWithHTML(`🦾 <b>NEURAL PULSE ONLINE</b>\n\nДобро пожаловать в систему, оператор.`, 
        Markup.inlineKeyboard([[
            Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", `${WEB_APP_URL}/?u=${uid}`)
        ]])
    );
});

// Обработка данных, присланных через tg.sendData() в Mini App
bot.on('web_app_data', async (ctx) => {
    logger.info(`📨 Получены данные из WebApp от ${ctx.from.id}`);
    try {
        const data = JSON.parse(ctx.webAppData.data());
        await ctx.reply(`✅ Действие "${data.action || 'сохранение'}" подтверждено.`);
    } catch (e) { logger.error("Ошибка парсинга webAppData"); }
});

// --- API ДЛЯ MINI APP ---

app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { 
            id: uid, balance: 0, energy: 1000, max_energy: 1000,
            click_lvl: 1, pnl: 0, last_seen: Date.now() 
        };
        saveData(); 
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    
    if (uid && usersData[uid]) {
        // Защита: не позволяем сохранить баланс меньше текущего (опционально)
        usersData[uid].balance = Math.max(usersData[uid].balance, Number(score));
        usersData[uid].energy = Number(energy);
        usersData[uid].last_seen = Date.now();
        
        // Фоновое сохранение раз в минуту (saveData() ниже), 
        // но критические изменения пишем сразу
        saveData(); 
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error", message: "User not found" });
});

// [6] ЗАПУСК (Boot Sequence)
async function boot() {
    initDatabase();
    
    logger.info("📡 Шаг 1: Настройка связи с Telegram...");
    try {
        const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        await bot.telegram.setWebhook(hookUrl);
        const info = await bot.telegram.getWebhookInfo();
        logger.info(`🔗 Вебхук активен: ${info.url}`);

        logger.info("🌐 Шаг 2: Запуск веб-сервера...");
        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`✅ [SYSTEM ONLINE] Port: ${PORT}`);
        });
    } catch (e) {
        logger.error(`🛑 КРИТИЧЕСКИЙ СБОЙ: ${e.message}`);
        setTimeout(() => process.exit(1), 5000);
    }
}

// Безопасное завершение
const syncInterval = setInterval(saveData, 60000);
const shutdown = () => { 
    clearInterval(syncInterval); 
    saveData(); 
    logger.info("💤 Система сохранена и выключена.");
    process.exit(0); 
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

boot();
