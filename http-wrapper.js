const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');
const { Telegraf, Markup } = require('telegraf');
const winston = require('winston');

// --- [1. КОНФИГУРАЦИЯ] ---
const API_TOKEN = "8257287930:AAG4hbfu1mF55SghPkrzt3_CZgh3tuds3x0";
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook-tg-pulse";
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const ADMIN_ID = 476014374; // Твой ID установлен

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/err.log', level: 'error' })
    ]
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
    } catch (e) { logger.error(`📂 БД ERROR: ${e.stack}`); }
}
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));
    } catch (e) { logger.error(`💾 БД ERROR: ${e.stack}`); }
}

// --- [3. РОУТЫ И API ДЛЯ ИГРЫ] ---
app.post(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) usersData[uid] = { id: uid, balance: 0, energy: 1000 };
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    if (uid && uid !== 'undefined') {
        if (!usersData[uid]) usersData[uid] = { id: uid, balance: 0 };
        if (score !== undefined) usersData[uid].balance = Number(score);
        if (energy !== undefined) usersData[uid].energy = Number(energy);
        saveData();
        return res.json({ status: "ok" });
    }
    res.status(400).send("Error: No ID");
});

// --- [4. АДМИН-ПАНЕЛЬ (ТОЛЬКО ДЛЯ ТЕБЯ)] ---
bot.command('admin_reset_db', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    usersData = {};
    saveData();
    await ctx.reply("💥 База данных успешно очищена.");
});

bot.command('admin_update', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await ctx.reply("🔄 Обновление кода с GitHub...");
    exec('git pull && npm install', (err, stdout) => {
        if (err) return ctx.reply(`❌ Ошибка git: ${err.message}`);
        ctx.reply(`✅ GitHub Update:\n${stdout.slice(0, 500)}`);
        setTimeout(() => process.exit(1), 2000); // Перезапуск через PM2
    });
});

bot.command('admin_reload', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await ctx.reply("🚀 Сброс кэша и перезапуск процесса...");
    setTimeout(() => process.exit(1), 1000);
});

bot.command('admin_errors', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        if (!fs.existsSync('logs/err.log')) return ctx.reply("Лг пуст.");
        const logData = fs.readFileSync('logs/err.log', 'utf8').slice(-1000);
        await ctx.reply(`📋 Лог ошибок:\n<pre>${logData}</pre>`, { parse_mode: 'HTML' });
    } catch (e) { ctx.reply("Не удалось прочитать логи."); }
});

// --- [5. ОБЫЧНЫЕ КОМАНДЫ] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    await ctx.replyWithHTML(
        `🦾 <b>NEURAL PULSE AI</b>\n\nСистема онлайн.\nТвой ID: <code>${uid}</code>`,
        Markup.inlineKeyboard([[Markup.button.webApp("ВХОД 🧠", `${WEB_APP_URL}/?u=${uid}`)]])
    );
});

// --- [6. ЗАПУСК] ---
loadData();
app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`🌐 SERVER: Слушает порт ${PORT}`);
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        await bot.telegram.setWebhook(`${WEB_APP_URL}${WEBHOOK_PATH}`);
        logger.info(`🤖 BOT: Вебхук установлен: ${WEB_APP_URL}${WEBHOOK_PATH}`);
        if (process.send) process.send('ready');
    } catch (e) { logger.error(`❌ WEBHOOK ERROR: ${e.message}`); }
});

process.on('SIGTERM', () => { saveData(); process.exit(0); });
