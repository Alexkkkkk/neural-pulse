const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. ЛОГИРОВАНИЕ] ---
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

// --- [2. КОНФИГУРАЦИЯ] ---
const API_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const ADMIN_ID = 476014374; 
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse";
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

const app = express();
const bot = new Telegraf(API_TOKEN);

// --- [3. БАЗА ДАННЫХ] ---
let usersData = {};
function initDatabase() {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
        }
        return Object.keys(usersData).length;
    } catch (e) {
        logger.error(`🚨 Ошибка БД: ${e.message}`);
        return 0;
    }
}

function saveData() {
    try {
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(usersData, null, 2));
        fs.renameSync(tmp, DATA_FILE);
        logger.debug("💾 [SYNC] База данных сохранена успешно");
    } catch (e) { logger.error(`💾 [ERR] Сохранение не удалось: ${e.message}`); }
}

// --- [4. НАСТРОЙКА СЕРВЕРА (MIDDLEWARES)] ---
app.use(express.json()); // ОБЯЗАТЕЛЬНО ПЕРЕД ВЕБХУКОМ
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

// Логирование входящих запросов от Telegram
app.post(WEBHOOK_PATH, (req, res, next) => {
    logger.debug(`📥 [TG UPDATE] ID: ${req.body.update_id}`);
    next();
}, bot.webhookCallback(WEBHOOK_PATH));

// --- [5. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const username = ctx.from.username || "Agent";
    
    try {
        // Красивая визуализация загрузки для пользователя
        const sentMsg = await ctx.replyWithHTML(
            `📡 <b>NEURAL PULSE: CONNECTION...</b>\n` +
            `<code>> Booting core system...</code>\n` +
            `<code>[▒▒▒▒▒▒▒▒▒▒] 15%</code>`,
            Markup.inlineKeyboard([[Markup.button.callback("АВТОРИЗАЦИЯ... ⏳", "loading")]])
        );

        setTimeout(() => {
            ctx.telegram.editMessageText(ctx.chat.id, sentMsg.message_id, null,
                `📡 <b>NEURAL PULSE: SYNCING...</b>\n` +
                `<code>> Loading user data: OK</code>\n` +
                `<code>[██████▒▒▒▒] 70%</code>`,
                { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("СИНХРОНИЗАЦИЯ... ⚙️", "loading")]]) }
            ).catch(() => {});
        }, 800);

        setTimeout(() => {
            ctx.telegram.editMessageText(ctx.chat.id, sentMsg.message_id, null,
                `🦾 <b>SYSTEM ONLINE: NEURAL PULSE AI</b>\n` +
                `----------------------------------\n` +
                `👤 АГЕНТ: <code>${username}</code>\n` +
                `🆔 СЕКТОР: <code>${uid}</code>\n` +
                `----------------------------------\n` +
                `✅ Доступ разрешен. Модули активны.`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", `${WEB_APP_URL}/?u=${uid}`)],
                        [Markup.button.url("КАНАЛ СВЯЗИ", "https://t.me/neural_pulse_news")]
                    ])
                }
            ).catch(() => {});
        }, 1600);
    } catch (e) { logger.error(`❌ [BOT ERR]: ${e.message}`); }
});

bot.action('loading', (ctx) => ctx.answerCbQuery("Система авторизации в процессе..."));

// --- [6. API ДЛЯ WEBAPP] ---
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) usersData[uid] = { id: uid, balance: 0, energy: 1000 };
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    if (uid && usersData[uid]) {
        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// --- [7. МАКСИМАЛЬНО КРУТОЙ BOOT SEQUENCE] ---
async function bootSystem() {
    console.clear();
    console.log("==========================================");
    logger.info("🚀 [0%] Инициализация NEURAL PULSE...");
    
    await new Promise(r => setTimeout(r, 400));
    const userCount = initDatabase();
    logger.info(`📂 [25%] БД загружена. Аккаунтов: ${userCount}`);
    
    await new Promise(r => setTimeout(r, 400));
    logger.info("🌐 [50%] Express Middleware: OK");
    
    try {
        // Проверка токена перед установкой вебхука
        const me = await bot.telegram.getMe();
        logger.info(`🤖 [75%] Telegram API: @${me.username} авторизован`);

        app.listen(PORT, '0.0.0.0', async () => {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            
            // КРИТИЧЕСКИЙ МОМЕНТ: Сброс старых ошибок и установка нового вебхука
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            
            logger.info(`✅ [100%] СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT}`);
            logger.info(`🌍 ВЕБХУК АКТИВЕН: ${hookUrl}`);
            console.log("==========================================");
        });
    } catch (e) {
        logger.error(`🛑 [FATAL] Ошибка запуска системы: ${e.message}`);
        process.exit(1);
    }
}

// Старт
bootSystem();

// Фоновое сохранение раз в минуту
setInterval(saveData, 60000);
