const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');
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
    logger.info("📂 БД [START]: Загрузка данных из файла...");
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            logger.info("📂 БД: Создана директория /data");
        }
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            logger.info(`📂 БД [OK]: Загружено профилей: ${Object.keys(usersData).length}`);
        } else {
            logger.info("📂 БД: Файл users.json не найден, создаем пустой объект");
        }
    } catch (e) { logger.error(`📂 БД ERROR: ${e.message}`); }
}

function saveData() {
    try {
        logger.debug("💾 БД: Начинаю сохранение...");
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(usersData, null, 2));
        fs.renameSync(tmp, DATA_FILE);
        logger.debug("💾 БД [OK]: Данные синхронизированы");
    } catch (e) { logger.error(`💾 БД ERROR: ${e.message}`); }
}

// --- [3. ОБРАБОТКА ВЕБХУКА] ---
app.post(WEBHOOK_PATH, (req, res, next) => {
    logger.debug(`📡 WEBHOOK: Пришел входящий POST-запрос`);
    next();
}, bot.webhookCallback(WEBHOOK_PATH));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

// --- [4. АДМИН-КОМАНДЫ] ---
bot.command('admin_reset_db', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return logger.warn(`🛑 SECURITY: Попытка сброса БД от ID ${ctx.from.id}`);
    usersData = {};
    saveData();
    logger.info(`💥 ADMIN: База данных очищена админом`);
    await ctx.reply("💥 База данных успешно очищена.");
});

bot.command('admin_update', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    logger.info(`🔄 ADMIN: Запрос обновления кода с GitHub`);
    await ctx.reply("🔄 Обновление кода...");
    exec('git pull && npm install', (err) => {
        if (err) {
            logger.error(`❌ GIT ERROR: ${err.message}`);
            return ctx.reply(`❌ Ошибка: ${err.message}`);
        }
        logger.info(`✅ GIT [OK]: Код обновлен. Инициирую перезагрузку.`);
        ctx.reply(`✅ Обновлено. Перезагрузка...`);
        setTimeout(() => process.exit(1), 1000);
    });
});

bot.command('admin_reload', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    logger.info(`🚀 ADMIN: Ручной перезапуск процесса`);
    await ctx.reply("🚀 Перезапуск процесса...");
    setTimeout(() => process.exit(1), 500);
});

// --- [5. ЛОГИКА БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const username = ctx.from.username || "Агент";
    logger.info(`🎯 BOT: Нажата /start. Пользователь: ${username} (${uid})`);
    
    const webAppUrl = `${WEB_APP_URL}/?u=${uid}`;
    
    try {
        await ctx.replyWithHTML(
            `🦾 <b>NEURAL PULSE AI</b>\n\nПривет, ${username}!\nТвой ID: <code>${uid}</code>\n\nНажми кнопку ниже.`,
            Markup.inlineKeyboard([
                [Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", webAppUrl)],
                [Markup.button.url("КАНАЛ", "https://t.me/neural_pulse_news")]
            ])
        );
        logger.info(`✅ BOT: Приветствие отправлено пользователю ${uid}`);
    } catch (e) { logger.error(`❌ BOT SEND ERROR: ${e.message}`); }
});

bot.on('text', (ctx) => {
    logger.debug(`📩 BOT: Получен текст от ${ctx.from.id}: ${ctx.text}`);
    ctx.reply("Система активна. Используйте /start для входа.");
});

// --- [6. API ДЛЯ WEBAPP] ---
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    logger.debug(`📡 API: Запрос данных для ID ${uid}`);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, last_active: Date.now() };
        logger.info(`🆕 API: Создан новый профиль для ${uid}`);
    }
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
        logger.debug(`📡 API SAVE [OK]: ID ${uid} сохранен`);
        return res.json({ status: "ok" });
    }
    logger.warn(`⚠️ API SAVE ERROR: Некорректный ID ${uid}`);
    res.status(400).json({ status: "error", message: "Invalid user_id" });
});

// --- [7. ЗАПУСК] ---
loadData();
setInterval(() => {
    logger.debug("🕒 CRON: Плановое автосохранение...");
    saveData();
}, 60000);

async function init() {
    try {
        logger.info("🤖 BOT [INIT]: Авторизация в Telegram...");
        const me = await bot.telegram.getMe();
        logger.info(`🤖 BOT [READY]: Запущен как @${me.username}`);

        app.listen(PORT, '0.0.0.0', async () => {
            logger.info(`🌐 SERVER [READY]: Порт ${PORT} открыт`);
            const hookUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            
            logger.info(`📡 WEBHOOK [SETTING]: Попытка установки: ${hookUrl}`);
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookUrl);
            logger.info(`🤖 BOT [WEBHOOK OK]: Вебхук успешно привязан.`);
        });
    } catch (e) {
        logger.error(`❌ FATAL ERROR ПРИ ЗАПУСКЕ: ${e.message}`);
    }
}

init();

// Безопасное завершение
process.on('SIGTERM', () => { 
    logger.info("⚠️ SIGTERM: Сохранение перед выключением...");
    saveData(); 
    process.exit(0); 
});
