const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

// [1] КОНФИГУРАЦИЯ
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const DOMAIN = "np.bothost.ru"; // Твой домен на Bothost
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const WEB_APP_URL = `https://${DOMAIN}`;

// Упрощаем путь вебхука, чтобы избежать ошибок 404
const WEBHOOK_PATH = '/telegram-webhook'; 

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
            console.log("📦 База данных загружена");
        } catch (e) { usersData = {}; }
    }
}
const saveDB = () => fs.writeFile(DATA_FILE, JSON.stringify(usersData, null, 2), () => {});

// [3] MIDDLEWARE
app.use(express.json());
app.use(cors());

// Важно: подключаем вебхук ДО раздачи статики
app.use(bot.webhookCallback(WEBHOOK_PATH));
app.use(express.static(path.join(__dirname, 'public')));

// [4] ЛОГИКА БОТА
bot.start(async (ctx) => {
    const name = ctx.from.first_name;
    console.log(`👤 Пользователь ${name} нажал START`);
    
    await ctx.replyWithHTML(
        `<b>🚀 Neural Pulse AI Активирован</b>\n\n` +
        `Привет, ${name}! Система мониторинга подключена.\n` +
        `Используй кнопку ниже для входа в сеть.`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('⚡ ЗАПУСТИТЬ ПРИЛОЖЕНИЕ', WEB_APP_URL)],
            [Markup.button.url('📢 Канал', 'https://t.me/your_channel')]
        ])
    );
});

bot.on('text', (ctx) => {
    const text = ctx.message.text.toLowerCase();
    if (text.includes('баланс')) {
        const bal = usersData[ctx.from.id]?.balance || 0;
        return ctx.replyWithHTML(`💰 Ваш баланс: <b>${bal} NP</b>`);
    }
    ctx.reply("🧬 Система онлайн. Нажмите кнопку в меню для игры.");
});

// [5] API ЭНДПОИНТЫ
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1 };
        saveDB();
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    if (uid && usersData[uid]) {
        usersData[uid].balance = Number(score);
        usersData[uid].energy = Number(energy);
        saveDB();
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// [6] ЗАПУСК
async function boot() {
    initDatabase();
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
        try {
            const finalUrl = `${WEB_APP_URL}${WEBHOOK_PATH}`;
            await bot.telegram.setWebhook(finalUrl);
            console.log(`✅ Вебхук успешно установлен на: ${finalUrl}`);
        } catch (e) {
            console.error("❌ Ошибка установки вебхука:", e.message);
        }
    });
}

boot();
