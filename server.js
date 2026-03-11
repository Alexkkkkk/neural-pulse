const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

console.log("🚀 [SYSTEM] Активация Гибридного ядра (Long Polling + Express)...");

// [1] КОНФИГУРАЦИЯ
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const DOMAIN = "np.bothost.ru"; 
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const WEB_APP_URL = `https://${DOMAIN}`;

const app = express();
const bot = new Telegraf(API_TOKEN);

// [2] БАЗА ДАННЫХ
let usersData = {};
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (fs.existsSync(DATA_FILE)) {
    try { usersData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}'); } 
    catch (e) { usersData = {}; }
}
const saveDB = () => fs.writeFile(DATA_FILE, JSON.stringify(usersData, null, 2), () => {});

// ==========================================
// [3] EXPRESS - ТОЛЬКО ДЛЯ WEB APP И API
// ==========================================
app.use(cors());
app.use(express.json());

// Логируем запросы к серверу (от приложения)
app.use((req, res, next) => {
    console.log(`🌐 [WEB] Запрос к API/Статике: ${req.method} ${req.url}`);
    next();
});

// API Эндпоинты
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000 };
        saveDB();
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    if (user_id && usersData[user_id]) {
        usersData[user_id].balance = Number(score);
        usersData[user_id].energy = Number(energy);
        saveDB();
        return res.json({ status: "ok" });
    }
    res.status(400).send("error");
});

// Раздача статики (твоя папка public)
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// [4] TELEGRAF - ПРЯМОЕ ПОДКЛЮЧЕНИЕ (LONG POLLING)
// ==========================================
bot.start((ctx) => {
    console.log(`🎯 [BOT] Команда /start от ${ctx.from.first_name} (ID: ${ctx.from.id})`);
    
    // Синхронизация БД при старте
    const uid = String(ctx.from.id);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000 };
        saveDB();
    }

    ctx.replyWithHTML(
        `<b>🚀 Система Neural Pulse активна!</b>\n\nКанал связи установлен напрямую.`,
        Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', WEB_APP_URL)]])
    );
});

bot.on('text', (ctx) => {
    console.log(`💬 [BOT] Сообщение от ${ctx.from.id}: ${ctx.message.text}`);
    if (ctx.message.text.toLowerCase().includes('баланс')) {
        const bal = usersData[ctx.from.id]?.balance || 0;
        return ctx.reply(`💰 Твой баланс: ${bal} NP`);
    }
    ctx.reply("🧬 Для начала майнинга нажми кнопку 'ИГРАТЬ' в меню!");
});

// ==========================================
// [5] ЗАПУСК СИСТЕМЫ
// ==========================================
async function boot() {
    // 1. Запускаем сервер для Web App
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🖥️ [EXPRESS] Сервер для Web App работает на порту: ${PORT}`);
    });

    // 2. Отключаем сломанный вебхук
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log(`🗑️ [WEBHOOK] Заблокированный вебхук удален`);
    } catch (e) {
        console.error("⚠️ [WEBHOOK] Ошибка при удалении:", e.message);
    }

    // 3. Запускаем бота напрямую
    try {
        bot.launch();
        console.log(`✅ [TELEGRAM] Бот запущен в режиме ПРЯМОГО подключения (Long Polling)!`);
    } catch (e) {
        console.error("❌ [BOT ERROR] Ошибка запуска бота:", e.message);
    }
}

boot();

// Защита от крашей
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
