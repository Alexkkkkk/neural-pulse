const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

console.log("1️⃣ [START] Скрипт запущен, импорт модулей завершен.");

// [1] КОНФИГУРАЦИЯ
const API_TOKEN = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN || "np.bothost.ru";
const PORT = process.env.PORT || 3000;
const DATA_DIR = "/app/data"; 
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const WEB_APP_URL = `https://${DOMAIN}`;
const WEBHOOK_PATH = "/webhook-tg-pulse";

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
            console.log("   -> Создаю папку /app/data...");
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
app.use(express.static(path.join(__dirname, 'public')));

// [4] API ЭНДПОИНТЫ
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    console.log(`📥 [API GET] Запрос баланса для: ${uid}`);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1, pnl: 0 };
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    if (user_id && usersData[user_id]) {
        usersData[user_id].balance = Number(score);
        usersData[user_id].energy = Number(energy);
        fs.writeFile(DATA_FILE, JSON.stringify(usersData, null, 2), () => {}); 
        return res.json({ status: "ok" });
    }
    res.status(400).send("error");
});

// [5] ОБРАБОТКА ВЕБХУКА
app.post(WEBHOOK_PATH, (req, res) => {
    bot.handleUpdate(req.body, res).catch(e => console.error("❌ [TG ERROR]", e));
});

// [6] ЗАПУСК (ГДЕ ЧАЩЕ ВСЕГО ЗАВИСАЕТ)
async function boot() {
    console.log("5️⃣ [BOOT] Вхожу в функцию boot()...");
    initDatabase();
    
    try {
        console.log("6️⃣ [TELEGRAM] Попытка установить Webhook...");
        const startHook = Date.now();
        
        // Установка вебхука может висеть, если сервер Telegram не отвечает
        await bot.telegram.setWebhook(`${WEB_APP_URL}${WEBHOOK_PATH}`)
            .then(() => console.log(`✅ [TELEGRAM] Webhook установлен за ${Date.now() - startHook}мс`))
            .catch(e => { throw new Error(`Ошибка Webhook: ${e.message}`) });

        console.log("7️⃣ [SERVER] Попытка запустить Express...");
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [SUCCESS] Система полностью онлайн на порту ${PORT}`);
        });

    } catch (e) { 
        console.error(`🛑 [FATAL] Остановка на этапе boot: ${e.message}`);
        console.log("💡 СОВЕТ: Проверь, правильно ли указан DOMAIN и BOT_TOKEN!");
    }
}

console.log("8️⃣ [EXECUTE] Вызов функции boot()...");
boot();
