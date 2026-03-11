const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

console.log("🚀 [SYSTEM] Инициализация ядра...");

// [1] КОНФИГУРАЦИЯ
const API_TOKEN = process.env.BOT_TOKEN || "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const DOMAIN = "np.bothost.ru"; 
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const WEB_APP_URL = `https://${DOMAIN}`;
const WEBHOOK_PATH = '/bot-webhook-debug'; // Изменили путь для чистого теста

const app = express();
const bot = new Telegraf(API_TOKEN);
let usersData = {};

// [2] БАЗА ДАННЫХ
function initDatabase() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            console.log(`📦 [DB] Загружено пользователей: ${Object.keys(usersData).length}`);
        }
    } catch (e) { console.error("🚨 [DB ERROR]", e.message); }
}
const saveDB = () => fs.writeFile(DATA_FILE, JSON.stringify(usersData, null, 2), () => {});

// [3] МИКРО-ДОСКОНАЛЬНОЕ ЛОГИРОВАНИЕ (Middleware уровня Express)
app.use((req, res, next) => {
    if (req.url === WEBHOOK_PATH) {
        console.log(`\n📥 [WEBHOOK INCOMING] --- ${new Date().toISOString()} ---`);
        console.log(`📡 IP отправителя: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
        console.log(`🛠 Метод: ${req.method} | Content-Type: ${req.headers['content-type']}`);
        
        // Перехватываем тело запроса для логов
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            if (data) {
                const body = JSON.parse(data);
                const updateId = body.update_id;
                const user = body.message?.from?.username || body.message?.from?.id || "Unknown";
                console.log(`🆔 Update ID: ${updateId} | От: ${user}`);
                if (body.message?.text) console.log(`📝 Текст: "${body.message.text}"`);
            }
        });
    }
    next();
});

app.use(express.json());
app.use(cors());

// [4] ОБРАБОТКА ВЕБХУКА (Telegraf)
app.use((req, res, next) => {
    if (req.url === WEBHOOK_PATH) {
        // Мы вызываем колбэк и ловим результат
        return bot.webhookCallback(WEBHOOK_PATH)(req, res, (err) => {
            if (err) console.error("🚨 [TELEGRAF ERROR]", err);
            next();
        });
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// [5] ЛОГИКА БОТА С ЛОГАМИ
bot.start(async (ctx) => {
    console.log(`🎯 [BOT] Команда /start от ${ctx.from.id}`);
    try {
        await ctx.replyWithHTML(
            `<b>🚀 Neural Pulse AI Активен</b>\n\nСистема логирования подтвердила твой вход.`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('⚡ ИГРАТЬ', WEB_APP_URL)]
            ])
        );
        console.log(`✅ [BOT] Ответ на /start успешно отправлен`);
    } catch (e) {
        console.error(`❌ [BOT ERROR] Не удалось отправить ответ:`, e.message);
    }
});

// [6] API ЭНДПОИНТЫ
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    console.log(`🔍 [API] Запрос баланса для: ${uid}`);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000 };
        saveDB();
    }
    res.json({ status: "ok", data: usersData[uid] });
});

// [7] ЗАПУСК С МОНИТОРИНГОМ СОСТОЯНИЯ
async function boot() {
    initDatabase();
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🖥️ [SERVER] Запущен на порту: ${PORT}`);
        try {
            const hookUrl = `https://${DOMAIN}${WEBHOOK_PATH}`;
            console.log(`🌐 [CONFIG] Целевой URL: ${hookUrl}`);
            
            // Удаляем старый вебхук перед установкой нового
            await bot.telegram.deleteWebhook();
            console.log(`🗑️ [WEBHOOK] Старый вебхук удален`);
            
            const success = await bot.telegram.setWebhook(hookUrl);
            if (success) {
                console.log(`✅ [WEBHOOK] УСТАНОВЛЕН УСПЕШНО: ${hookUrl}`);
            } else {
                console.log(`⚠️ [WEBHOOK] Telegram вернул false при установке`);
            }
            
            // Проверка статуса через API Telegram
            const info = await bot.telegram.getWebhookInfo();
            console.log(`📊 [WEBHOOK INFO] Текущий статус в Telegram:`, JSON.stringify(info, null, 2));

        } catch (e) {
            console.error("❌ [FATAL ERROR] Ошибка при запуске вебхука:", e.message);
        }
    });
}

boot();
