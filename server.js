const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const rateLimit = require('express-rate-limit');

// [1] КОНФИГУРАЦИЯ И СТИЛЬ
const CONFIG = {
    TOKEN: process.env.BOT_TOKEN || "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs",
    DOMAIN: "np.bothost.ru",
    PORT: process.env.PORT || 3000,
    WEBHOOK_PATH: '/gate/v1/neural-sync', // Скрытый путь для безопасности
    DATA_PATH: path.join(__dirname, 'data', 'users.json')
};

const app = express();
const bot = new Telegraf(CONFIG.TOKEN);

// [2] БАЗА ДАННЫХ С АВТО-БЭКАПОМ
let users = {};
const loadDB = () => {
    try {
        if (!fs.existsSync(path.dirname(CONFIG.DATA_PATH))) fs.mkdirSync(path.dirname(CONFIG.DATA_PATH));
        users = fs.existsSync(CONFIG.DATA_PATH) ? JSON.parse(fs.readFileSync(CONFIG.DATA_PATH)) : {};
        console.log(`💎 [SYSTEM] Neural Core загружен. Активных узлов: ${Object.keys(users).length}`);
    } catch (e) { console.error("🚨 [DB_LOAD_ERR]", e); users = {}; }
};
const saveDB = () => fs.writeFileSync(CONFIG.DATA_PATH, JSON.stringify(users, null, 2));

// [3] ЗАЩИТА И СЕТЬ (Middleware)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }); // Защита API от перегрузки

app.use(cors());
app.use(express.json());
app.use('/api/', limiter);
app.use(express.static(path.join(__dirname, 'public')));

// Ультра-логирование (визуально чистое)
app.use((req, res, next) => {
    if (req.url === CONFIG.WEBHOOK_PATH) {
        const upid = req.body?.update_id;
        console.log(`📡 [PULSE] Входящий сигнал: ${upid} | IP: ${req.ip.replace('::ffff:', '')}`);
    }
    next();
});

// [4] СИСТЕМА УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ (API)
app.get('/api/v1/sync/:id', (req, res) => {
    const id = req.params.id;
    if (!users[id]) users[id] = { id, balance: 0, energy: 1000, level: 1, lastSync: Date.now() };
    res.json({ success: true, user: users[id] });
});

app.post('/api/v1/save', (req, res) => {
    const { id, balance, energy } = req.body;
    if (id && users[id]) {
        users[id] = { ...users[id], balance: Number(balance), energy: Number(energy), lastSync: Date.now() };
        saveDB();
        return res.json({ success: true });
    }
    res.status(403).json({ success: false, error: 'Unauthorized Node' });
});

// [5] ИНТЕРФЕЙС БОТА (Next-Gen UI)
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const firstName = ctx.from.first_name || 'Agent';
    
    if (!users[uid]) {
        users[uid] = { id: uid, balance: 0, energy: 1000, level: 1, lastSync: Date.now() };
        saveDB();
    }

    const welcomeMsg = 
        `<b>🛰 NEURAL PULSE: CONNECTION ESTABLISHED</b>\n\n` +
        `Приветствуем, <b>${firstName}</b>. Твой биометрический профиль синхронизирован.\n\n` +
        `🧬 <b>Твои данные:</b>\n` +
        `├ ID: <code>${uid}</code>\n` +
        `├ Статус: <pre>Online</pre>\n` +
        `└ Баланс: 💰 <b>${users[uid].balance} NP</b>\n\n` +
        `<i>Используй высокочастотный доступ для добычи токенов.</i>`;

    await ctx.replyWithPhoto(
        { url: 'https://img.freepik.com/free-vector/abstract-technology-particle-background_23-2148425219.jpg' }, // Можно заменить на свое лого
        {
            caption: welcomeMsg,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.webApp('⚡ ВХОД В СИСТЕМУ', `https://${CONFIG.DOMAIN}`)],
                [Markup.button.url('📡 КАНАЛ СВЯЗИ', 'https://t.me/your_channel'), Markup.button.url('🤝 ПОДДЕРЖКА', 'https://t.me/your_support')]
            ])
        }
    );
});

// [6] ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
bot.catch((err, ctx) => {
    console.error(`🚨 [CRITICAL_BOT_ERR] User: ${ctx.from.id}`, err);
});

// [7] ЗАПУСК ЯДРА
async function startup() {
    loadDB();
    
    app.post(CONFIG.WEBHOOK_PATH, (req, res) => bot.handleUpdate(req.body, res));

    app.listen(CONFIG.PORT, '0.0.0.0', async () => {
        console.log(`\n————————————————————————————————————————————————`);
        console.log(`🟢 NEURAL PULSE ENGINE STARTED ON PORT: ${CONFIG.PORT}`);
        console.log(`🌐 DOMAIN: https://${CONFIG.DOMAIN}`);
        
        try {
            const hookUrl = `https://${CONFIG.DOMAIN}${CONFIG.WEBHOOK_PATH}`;
            await bot.telegram.setWebhook(hookUrl, {
                allowed_updates: ['message', 'callback_query'],
                drop_pending_updates: true // Очистка при каждом перезапуске для чистоты
            });
            console.log(`✅ WEBHOOK: Синхронизирован`);
        } catch (e) { console.log(`❌ WEBHOOK: Ошибка связи`); }
        console.log(`————————————————————————————————————————————————\n`);
    });
}

startup();

// Безопасное завершение
process.once('SIGINT', () => saveDB());
process.once('SIGTERM', () => saveDB());
