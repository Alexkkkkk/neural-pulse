const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

console.log("🚀 [SYSTEM] Запуск глубокого мониторинга...");

// [1] КОНФИГУРАЦИЯ
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const DOMAIN = "np.bothost.ru"; 
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const WEB_APP_URL = `https://${DOMAIN}`;
const WEBHOOK_PATH = '/bot-webhook-debug'; 

const app = express();
const bot = new Telegraf(API_TOKEN);

// [2] БАЗА ДАННЫХ
let usersData = {};
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (fs.existsSync(DATA_FILE)) {
    try {
        usersData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
    } catch (e) { usersData = {}; }
}
const saveDB = () => fs.writeFile(DATA_FILE, JSON.stringify(usersData, null, 2), () => {});

// [3] MIDDLEWARE
app.use(cors());
app.use(express.json()); // Оставляем только один парсер

// МИКРО-ЛОГИРОВАНИЕ КАЖДОГО ЗАПРОСА
app.use((req, res, next) => {
    if (req.url === WEBHOOK_PATH) {
        console.log(`\n📥 [HOOK] Входящий запрос: ${req.method} ${req.url}`);
        console.log(`📡 Headers: ${JSON.stringify(req.headers['x-forwarded-for'] || req.ip)}`);
        
        // Логируем тело, если оно уже распаршено express.json()
        if (req.body && Object.keys(req.body).length > 0) {
            console.log(`📦 Body: ${JSON.stringify(req.body)}`);
        } else {
            console.log(`⚠️ Внимание: Тело запроса пустое!`);
        }
    }
    next();
});

// [4] ОБРАБОТКА ВЕБХУКА
app.post(WEBHOOK_PATH, (req, res) => {
    bot.handleUpdate(req.body, res)
        .then(() => {
            if (!res.writableEnded) res.sendStatus(200);
            console.log("✅ [OK] Update обработан Telegraf");
        })
        .catch((err) => {
            console.error("🚨 [ERROR] Ошибка внутри Telegraf:", err);
            res.sendStatus(500);
        });
});

app.use(express.static(path.join(__dirname, 'public')));

// [5] ЛОГИКА БОТА
bot.start((ctx) => {
    console.log(`🎯 [BOT] Команда /start от ${ctx.from.id}`);
    ctx.replyWithHTML(
        `<b>🚀 Система Neural Pulse активна!</b>\n\nТвой ID: <code>${ctx.from.id}</code>`,
        Markup.inlineKeyboard([[Markup.button.webApp('⚡ ИГРАТЬ', WEB_APP_URL)]])
    );
});

// [6] ЗАПУСК С ОЧИСТКОЙ ОЧЕРЕДИ
async function boot() {
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🖥️ [SERVER] Работает на порту: ${PORT}`);
        try {
            const hookUrl = `https://${DOMAIN}${WEBHOOK_PATH}`;
            
            // КРИТИЧНО: Очищаем очередь застрявших 12 сообщений
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            console.log(`🗑️ [WEBHOOK] Очередь очищена`);
            
            await bot.telegram.setWebhook(hookUrl);
            console.log(`✅ [WEBHOOK] Установлен: ${hookUrl}`);
            
            const info = await bot.telegram.getWebhookInfo();
            console.log(`📊 [STATUS]:`, JSON.stringify(info, null, 2));
        } catch (e) {
            console.error("❌ [BOOT ERROR]:", e.message);
        }
    });
}

boot();
