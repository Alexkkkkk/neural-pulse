const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ ЛОГОВ] ---
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

// --- [2. КОНФИГУРАЦИЯ СИСТЕМЫ] ---
const API_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const ADMIN_ID = 476014374; 
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse";
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

const app = express();
app.set('trust proxy', 1);
const bot = new Telegraf(API_TOKEN);

// --- [3. ГЛУБОКОЕ ЛОГИРОВАНИЕ БАЗЫ ДАННЫХ] ---
let usersData = {};

function loadData() {
    logger.info("📂 [БД] Чтение файла пользователей...");
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            
            const count = Object.keys(usersData).length;
            logger.info(`✅ [БД] Загружено профилей: ${count}`);
            
            // Вывод списка ID для контроля (если есть пользователи)
            if (count > 0) {
                logger.debug(`📝 [БД] Список ID: ${Object.keys(usersData).join(', ')}`);
            }
        } else {
            logger.warn("⚠️ [БД] Файл users.json отсутствует. Будет создан автоматически.");
        }
    } catch (e) { 
        logger.error(`❌ [БД ERROR]: Ошибка парсинга JSON: ${e.message}`); 
    }
}

function saveData() {
    try {
        const count = Object.keys(usersData).length;
        const tmp = DATA_FILE + '.tmp';
        const dataString = JSON.stringify(usersData, null, 2);
        
        fs.writeFileSync(tmp, dataString);
        fs.renameSync(tmp, DATA_FILE);
        
        logger.debug(`💾 [БД] Синхронизация: ${count} юзеров сохранено (${Buffer.byteLength(dataString)} байт)`);
    } catch (e) { 
        logger.error(`❌ [БД ERROR]: Ошибка сохранения: ${e.message}`); 
    }
}

// --- [4. ОБРАБОТКА СЕТИ] ---
app.post(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

// Логируем каждый запрос к API
app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
        logger.debug(`🌐 [API] Запрос: ${req.method} ${req.url}`);
    }
    next();
});

// --- [5. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const username = ctx.from.username || "Agent";
    logger.info(`🎯 [BOT] Старт протокола для пользователя: ${username} (${uid})`);

    try {
        const sentMsg = await ctx.replyWithHTML(
            `📡 <b>NEURAL PULSE: CONNECTION...</b>\n<code>[▒▒▒▒▒▒▒▒▒▒] 10%</code>`,
            Markup.inlineKeyboard([[Markup.button.callback("ИНИЦИАЛИЗАЦИЯ... ⏳", "loading")]])
        );

        setTimeout(() => {
            ctx.telegram.editMessageText(ctx.chat.id, sentMsg.message_id, null,
                `📡 <b>NEURAL PULSE: SYNCING...</b>\n<code>[██████▒▒▒▒] 65%</code>`,
                { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("ЗАГРУЗКА... ⚙️", "loading")]]) }
            ).catch(() => {});
        }, 800);

        setTimeout(() => {
            ctx.telegram.editMessageText(ctx.chat.id, sentMsg.message_id, null,
                `🦾 <b>SYSTEM ONLINE: NEURAL PULSE AI</b>\n` +
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
    } catch (e) { logger.error(`❌ [BOT ERROR]: ${e.message}`); }
});

bot.action('loading', (ctx) => ctx.answerCbQuery("Система загружается..."));

// --- [6. API] ---
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000 };
        logger.info(`🆕 [БД] Создан новый профиль: ${uid}`);
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
        // Логируем крупные изменения баланса (например, каждые 100 монет)
        if (score % 100 === 0) {
            logger.debug(`💰 [USER ${uid}] Новый баланс: ${score}`);
        }
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// --- [7. ЗАПУСК С ПРОГРЕСС-ЛОГОМ] ---
async function bootSystem() {
    console.clear();
    console.log("==========================================");
    logger.info("🚀 [0%] Запуск ядра NEURAL PULSE...");
    
    await new Promise(r => setTimeout(r, 600));
    loadData();
    logger.info(`📂 [25%] Анализ базы данных завершен.`);
    
    await new Promise(r => setTimeout(r, 600));
    logger.info("🌐 [50%] Поднятие HTTP-сервера и CORS-фильтров...");
    
    await new Promise(r => setTimeout(r, 600));
    logger.info("🤖 [75%] Синхронизация с Telegram API...");
    
    try {
        await bot.telegram.getMe();
        app.listen(PORT, '0.0.0.0', async () => {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            await bot.telegram.setWebhook(hookUrl);
            
            await new Promise(r => setTimeout(r, 600));
            console.log("==========================================");
            logger.info(`✅ [100%] СИСТЕМА ПОЛНОСТЬЮ АКТИВНА`);
            logger.info(`🌍 Доступ: ${WEB_APP_URL}`);
            logger.info(`🛠 Порт: ${PORT}`);
            console.log("==========================================");
        });
    } catch (e) {
        logger.error(`❌ [КРИТИЧЕСКАЯ ОШИБКА]: ${e.message}`);
        process.exit(1);
    }
}

bootSystem();
setInterval(saveData, 60000); // Сохранение раз в минуту
