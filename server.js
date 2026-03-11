const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

console.log("1️⃣ [START] Скрипт запущен, импорт модулей завершен.");

// [1] КОНФИГУРАЦИЯ
const API_TOKEN = process.env.BOT_TOKEN; // Убедись, что добавил в панели Bothost!
const DOMAIN = process.env.DOMAIN || "np.bothost.ru"; // Твой домен
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data'); // ИСПРАВЛЕНО: Правильный локальный путь
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const WEB_APP_URL = `https://${DOMAIN}`;
const WEBHOOK_PATH = `/webhook-${API_TOKEN}`; // Безопасный путь для вебхука

if (!API_TOKEN) {
    console.error("🛑 [FATAL ERROR] Токен бота не найден! Добавь BOT_TOKEN в переменные окружения.");
    process.exit(1);
}

console.log(`2️⃣ [CONFIG] URL: ${WEB_APP_URL}, Port: ${PORT}`);

const app = express();
const bot = new Telegraf(API_TOKEN);
let usersData = {};

// [2] БАЗА ДАННЫХ
function initDatabase() {
    const startDB = Date.now();
    console.log("3️⃣ [DB] Начало инициализации базы...");
    try {
        if (!fs.existsSync(DATA_DIR)) {
            console.log("   -> Создаю папку data...");
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        
        if (fs.existsSync(DATA_FILE)) {
            console.log("   -> Читаю файл users.json...");
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
        } else {
            console.log("   -> Файл базы не найден, создаю новый...");
            usersData = {};
            fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
        }
        console.log(`✅ [DB] Загружено за ${Date.now() - startDB}мс. Юзеров: ${Object.keys(usersData).length}`);
    } catch (e) { 
        console.error(`🚨 [DB ERROR] Критическая ошибка БД: ${e.message}`); 
    }
}

// [3] MIDDLEWARE
console.log("4️⃣ [APP] Настройка Express...");
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); // Указываем папку со статикой

// [4] TELEGRAM БОТ (ДОБАВЛЕНО: Команда /start)
bot.start((ctx) => {
    ctx.reply(
        '🧠 Добро пожаловать в Neural Pulse AI!\n\nЖми кнопку ниже, чтобы начать фармить токены.', 
        Markup.inlineKeyboard([
            Markup.button.webApp('🚀 Запустить Neural Pulse', WEB_APP_URL)
        ])
    );
});

// [5] API ЭНДПОИНТЫ
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    console.log(`📥 [API GET] Запрос баланса для: ${uid}`);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1, pnl: 0, last_seen: Date.now() };
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    if (user_id && usersData[user_id]) {
        usersData[user_id].balance = Number(score);
        usersData[user_id].energy = Number(energy);
        usersData[user_id].last_seen = Date.now();
        fs.writeFile(DATA_FILE, JSON.stringify(usersData, null, 2), () => {}); 
        return res.json({ status: "ok" });
    }
    res.status(400).send("error");
});

// [6] ОБРАБОТКА ВЕБХУКА
app.use(bot.webhookCallback(WEBHOOK_PATH));

// [7] ЗАПУСК
async function boot() {
    console.log("5️⃣ [BOOT] Вхожу в функцию boot()...");
    initDatabase();
    
    try {
        console.log("6️⃣ [SERVER] Запуск Express сервера...");
        app.listen(PORT, '0.0.0.0', async () => {
            console.log(`🚀 [SUCCESS] Сервер запущен на порту ${PORT}`);
            
            console.log("7️⃣ [TELEGRAM] Попытка установить Webhook...");
            try {
                await bot.telegram.setWebhook(`${WEB_APP_URL}${WEBHOOK_PATH}`);
                console.log(`✅ [TELEGRAM] Webhook успешно установлен на ${WEB_APP_URL}`);
            } catch (whError) {
                console.error(`❌ [TELEGRAM ERROR] Ошибка Webhook. Проверь DOMAIN! ${whError.message}`);
            }
        });
    } catch (e) { 
        console.error(`🛑 [FATAL] Остановка на этапе boot: ${e.message}`);
    }
}

boot();
