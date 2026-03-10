const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const ADMIN_ID = 476014374; 
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse";
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

const app = express();
app.set('trust proxy', 1);
const bot = new Telegraf(API_TOKEN);

// --- [2. БАЗА ДАННЫХ] ---
let usersData = {};
function loadData() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
        }
    } catch (e) { logger.error(`📂 БД ERROR: ${e.message}`); }
}

function saveData() {
    try {
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(usersData, null, 2));
        fs.renameSync(tmp, DATA_FILE);
        logger.debug("💾 БД: Синхронизация завершена");
    } catch (e) { logger.error(`💾 БД ERROR: ${e.message}`); }
}

// --- [3. ОБРАБОТКА ВЕБХУКА] ---
app.post(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

// --- [4. АДМИН-КОМАНДЫ] ---
bot.command('admin_reload', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await ctx.reply("🚀 Rebooting...");
    setTimeout(() => process.exit(1), 500);
});

// --- [5. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const username = ctx.from.username || "Agent";
    
    try {
        const sentMsg = await ctx.replyWithHTML(
            `📡 <b>NEURAL PULSE: CONNECTION...</b>\n` +
            `<code>> Booting core system...</code>\n` +
            `<code>[▒▒▒▒▒▒▒▒▒▒] 10%</code>`,
            Markup.inlineKeyboard([[Markup.button.callback("ИНИЦИАЛИЗАЦИЯ... ⏳", "loading")]])
        );

        setTimeout(async () => {
            await ctx.telegram.editMessageText(
                ctx.chat.id, sentMsg.message_id, null,
                `📡 <b>NEURAL PULSE: SYNCING...</b>\n` +
                `<code>> Loading user data: OK</code>\n` +
                `<code>[██████▒▒▒▒] 65%</code>`,
                { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("ЗАГРУЗКА... ⚙️", "loading")]]) }
            ).catch(() => {});
        }, 800);

        setTimeout(async () => {
            await ctx.telegram.editMessageText(
                ctx.chat.id, sentMsg.message_id, null,
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
    } catch (e) { logger.error(`❌ BOT ERROR: ${e.message}`); }
});

bot.action('loading', (ctx) => ctx.answerCbQuery("Загрузка систем..."));

// --- [6. API] ---
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) usersData[uid] = { id: uid, balance: 0, energy: 1000 };
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    if (uid && uid !== 'undefined') {
        if (!usersData[uid]) usersData[uid] = { id: uid, balance: 0, energy: 1000 };
        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        saveData();
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// --- [7. ЗАПУСК С ЛОГОМ ЗАГРУЗКИ] ---
async function bootSystem() {
    console.clear();
    logger.info("🚀 [0%] Инициализация ядра...");
    
    await new Promise(r => setTimeout(r, 500));
    loadData();
    logger.info(`📂 [25%] База данных загружена (${Object.keys(usersData).length} профилей)`);
    
    await new Promise(r => setTimeout(r, 500));
    logger.info("🌐 [50%] Настройка Express и CORS...");
    
    await new Promise(r => setTimeout(r, 500));
    logger.info("🤖 [75%] Подключение к Telegram API...");
    
    try {
        await bot.telegram.getMe();
        app.listen(PORT, '0.0.0.0', async () => {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            await bot.telegram.setWebhook(hookUrl);
            logger.info(`✅ [100%] СИСТЕМА АКТИВНА: ${hookUrl}`);
            logger.info(`🚀 Порт: ${PORT} | Удачи, Админ!`);
        });
    } catch (e) {
        logger.error(`❌ ОШИБКА ЗАПУСКА: ${e.message}`);
        process.exit(1);
    }
}

bootSystem();
setInterval(saveData, 60000);
