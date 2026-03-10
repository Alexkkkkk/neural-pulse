const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os'); // Встроенный модуль Node.js для телеметрии
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// ==========================================
// [1] ЯДРО ЛОГИРОВАНИЯ (С ЦВЕТОМ И МЕТРИКАМИ)
// ==========================================
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss.SSS' }), // Миллисекунды для профилирования
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()} > ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

// ==========================================
// [2] ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ СИСТЕМЫ
// ==========================================
const API_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const ADMIN_ID = 476014374; 
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse";

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const BACKUP_FILE = path.join(DATA_DIR, 'users.bak');

const app = express();
app.set('trust proxy', 1);
const bot = new Telegraf(API_TOKEN);

// ==========================================
// [3] ДВИЖОК БАЗЫ ДАННЫХ (С АВТО-БЭКАПАМИ)
// ==========================================
let usersData = {};

function initDatabase() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        
        // Создаем бэкап при каждом старте (защита от потери данных)
        if (fs.existsSync(DATA_FILE)) {
            fs.copyFileSync(DATA_FILE, BACKUP_FILE);
            logger.info("🛡️ [DB SECURITY] Создана резервная копия базы данных (users.bak)");
            
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
        }
        return Object.keys(usersData).length;
    } catch (e) {
        logger.error(`🚨 [DB CRASH] Критическая ошибка чтения: ${e.message}`);
        return 0;
    }
}

function saveData() {
    try {
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(usersData, null, 2));
        fs.renameSync(tmp, DATA_FILE); // Атомарная перезапись (Atomic Write)
        logger.debug(`💾 [SYNC] Данные сохранены. Размер RAM: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) { 
        logger.error(`💾 [SYNC ERROR] Не удалось сохранить БД: ${e.message}`); 
    }
}

// ==========================================
// [4] СЕТЕВОЙ СЛОЙ (EXPRESS & MIDDLEWARE)
// ==========================================
app.use(express.json()); // Строго ПЕРЕД маршрутами!
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

// Эндпоинт для мониторинга (Health Check)
app.get('/health', (req, res) => {
    res.json({ status: 'ONLINE', uptime: process.uptime(), users: Object.keys(usersData).length });
});

// Перехватчик Telegram Webhook
app.post(WEBHOOK_PATH, (req, res, next) => {
    logger.debug(`📥 [TG STREAM] Входящий пакет: ID ${req.body.update_id}`);
    next();
}, bot.webhookCallback(WEBHOOK_PATH));

// ==========================================
// [5] ИНТЕРФЕЙС БОТА (КИНЕМАТОГРАФИЧНЫЙ ЗАПУСК)
// ==========================================
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : "Неизвестный агент";
    logger.info(`🎯 [LOGIN] Запрос авторизации от ${uid} (${username})`);

    try {
        // Кадр 1
        const msg = await ctx.replyWithHTML(
            `🖥 <b>NEURAL TERMINAL v3.0</b>\n<code>> Establishing secure link...</code>\n<code>[▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒] 10%</code>`,
            Markup.inlineKeyboard([[Markup.button.callback("ПИНГ СЕРВЕРА... 📡", "ignore")]])
        );

        // Кадр 2 (через 600мс)
        await delay(600);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
            `🖥 <b>NEURAL TERMINAL v3.0</b>\n<code>> Bypassing firewall protocols...</code>\n<code>[████▒▒▒▒▒▒▒▒▒▒▒] 35%</code>`,
            { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("ОБХОД ЗАЩИТЫ... 🛡", "ignore")]]) }
        ).catch(() => {});

        // Кадр 3 (через 600мс)
        await delay(600);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
            `🖥 <b>NEURAL TERMINAL v3.0</b>\n<code>> Decrypting user sector... OK</code>\n<code>[██████████▒▒▒▒▒] 75%</code>`,
            { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("РАСШИФРОВКА... 🧬", "ignore")]]) }
        ).catch(() => {});

        // Кадр 4 - ФИНАЛ (через 600мс)
        await delay(600);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
            `🦾 <b>ACCESS GRANTED: NEURAL PULSE</b>\n` +
            `===========================\n` +
            `👤 АГЕНТ: <code>${username}</code>\n` +
            `🆔 СЕКТОР: <code>${uid}</code>\n` +
            `===========================\n` +
            `⚡️ Нейронная сеть готова к работе.`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", `${WEB_APP_URL}/?u=${uid}`)],
                    [Markup.button.url("КАНАЛ СВЯЗИ 📡", "https://t.me/neural_pulse_news")]
                ])
            }
        ).catch(() => {});
    } catch (e) { logger.error(`❌ [BOT UI ERROR]: ${e.message}`); }
});

bot.action('ignore', (ctx) => ctx.answerCbQuery("Идет процесс подключения... ⏳"));

// ==========================================
// [6] БОЕВОЙ API ДЛЯ WEBAPP
// ==========================================
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, last_seen: Date.now() };
        logger.info(`🌟 [NEW USER] Зарегистрирован ID: ${uid}`);
        saveData(); // Сохраняем сразу при новой регистрации
    }
    usersData[uid].last_seen = Date.now();
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    
    if (uid && usersData[uid]) {
        usersData[uid].balance = Number(score);
        usersData[uid].energy = Number(energy);
        usersData[uid].last_seen = Date.now();
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error", message: "User session not found" });
});

// ==========================================
// [7] АБСОЛЮТНЫЙ BOOT SEQUENCE & SHUTDOWN
// ==========================================
let server;

async function bootSystem() {
    console.clear();
    console.log("\n███╗   ██╗███████╗██╗   ██╗██████╗  █████╗ ██╗     ");
    console.log("████╗  ██║██╔════╝██║   ██║██╔══██╗██╔══██╗██║     ");
    console.log("██╔██╗ ██║█████╗  ██║   ██║██████╔╝███████║██║     ");
    console.log("██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██╔══██║██║     ");
    console.log("██║ ╚████║███████╗╚██████╔╝██║  ██║██║  ██║███████╗");
    console.log("╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝\n");
    
    logger.info(`🚀 [BOOT] OS: ${os.type()} ${os.release()} | CPU Core: ${os.cpus().length}`);
    logger.info(`🚀 [BOOT] Инициализация ядра системы...`);
    
    await delay(500);
    const userCount = initDatabase();
    logger.info(`📂 [BOOT] База загружена. Активных агентов: ${userCount}`);
    
    await delay(500);
    logger.info("🌐 [BOOT] Сетевые фильтры и CORS активированы.");
    
    try {
        const me = await bot.telegram.getMe();
        logger.info(`🤖 [BOOT] Telegram API Token VALID: @${me.username}`);

        server = app.listen(PORT, '0.0.0.0', async () => {
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            
            // Очистка мертвых очередей (Лечение ошибки 404)
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            
            console.log("==================================================");
            logger.info(`✅ [SYSTEM ONLINE] СЕРВЕР СЛУШАЕТ ПОРТ: ${PORT}`);
            logger.info(`🌍 [WEBHOOK] КАНАЛ СВЯЗИ: ${hookUrl}`);
            logger.info(`💻 [TELEMETRY] RAM Свободно: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
            console.log("==================================================");
        });
    } catch (e) {
        logger.error(`🛑 [FATAL CRASH] ${e.message}`);
        process.exit(1);
    }
}

// Фоновое автосохранение
const syncInterval = setInterval(saveData, 60000);

// --- ЗАЩИТА ОТ ПОТЕРИ ДАННЫХ ПРИ ПЕРЕЗАГРУЗКЕ (GRACEFUL SHUTDOWN) ---
function shutdown(signal) {
    logger.warn(`\n⚠️ [SHUTDOWN] Получен сигнал ${signal}. Запуск протокола консервации...`);
    clearInterval(syncInterval);
    saveData(); // Принудительное сохранение перед смертью процесса
    
    if (server) {
        server.close(() => {
            logger.info("🔒 [SHUTDOWN] Сетевые порты закрыты.");
            logger.info("💤 [SHUTDOWN] Система остановлена безопасно.");
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}

process.once('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C в консоли
process.once('SIGTERM', () => shutdown('SIGTERM')); // Остановка сервером Bothost

// Старт!
bootSystem();
