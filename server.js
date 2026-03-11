const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

// [1] КОНФИГУРАЦИЯ
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const DOMAIN = process.env.DOMAIN || "np.bothost.ru"; 
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const WEB_APP_URL = `https://${DOMAIN}`;
const WEBHOOK_PATH = `/webhook-${API_TOKEN.split(':')[0]}`;

const app = express();
const bot = new Telegraf(API_TOKEN);
let usersData = {};

// [2] БАЗА ДАННЫХ
function initDatabase() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
        try {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
        } catch (e) { usersData = {}; }
    }
}
const saveDB = () => fs.writeFile(DATA_FILE, JSON.stringify(usersData, null, 2), () => {});

// [3] MIDDLEWARE
app.use(express.json());
app.use(cors());
app.use(bot.webhookCallback(WEBHOOK_PATH));
app.use(express.static(path.join(__dirname, 'public')));

// [4] САМАЯ КРУТАЯ ПРОСЛУШКА И МОНИТОРИНГ
// Мониторинг каждого входа (Middleware бота)
bot.use(async (ctx, next) => {
    if (ctx.from) {
        console.log(`📡 [MONITOR] Активность от пользователя: ${ctx.from.username || ctx.from.id}`);
        const uid = String(ctx.from.id);
        if (!usersData[uid]) {
            usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1, last_seen: Date.now() };
            saveDB();
        }
    }
    return next();
});

// КРУТОЙ ОТВЕТ НА СТАРТ
bot.start(async (ctx) => {
    const name = ctx.from.first_name;
    await ctx.replyWithHTML(
        `<b>🚀 Привет, ${name}! Добро пожаловать в Neural Pulse AI</b>\n\n` +
        `Система прослушки активирована. Твой статус: <i>В сети</i>\n` +
        `Жми кнопку ниже, чтобы войти в нейронную сеть и начать добычу.`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('⚡ ЗАПУСТИТЬ NEURAL PULSE', WEB_APP_URL)],
            [Markup.button.url('👥 Наш Канал', 'https://t.me/your_channel'), Markup.button.url('💬 Чат сообщества', 'https://t.me/your_chat')]
        ])
    );
});

// ПРОСЛУШКА СООБЩЕНИЙ (КРУТОЙ ИНТЕЛЛЕКТ)
bot.on('text', (ctx) => {
    const text = ctx.message.text.toLowerCase();
    const uid = String(ctx.from.id);

    if (text.includes('баланс')) {
        const bal = usersData[uid]?.balance || 0;
        return ctx.replyWithHTML(`💰 <b>Твой текущий счет:</b> ${bal} NP`);
    }

    ctx.replyWithHTML('🧬 <i>Система мониторинга активна. Используй меню для доступа к приложению.</i>');
});

// [5] API ЭНДПОИНТЫ
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1 };
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    if (user_id && usersData[user_id]) {
        usersData[user_id].balance = Number(score);
        usersData[user_id].energy = Number(energy);
        usersData[user_id].last_seen = Date.now();
        saveDB();
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// [7] ЗАПУСК
async function boot() {
    initDatabase();
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🚀 [SERVER] Система запущена на порту ${PORT}`);
        try {
            await bot.telegram.setWebhook(`${WEB_APP_URL}${WEBHOOK_PATH}`);
            console.log(`✅ [WEBHOOK] Мониторинг Telegram активирован!`);
        } catch (e) { console.error("❌ Ошибка WH:", e.message); }
    });
}

boot();
