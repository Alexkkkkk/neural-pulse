const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

console.log("1️⃣ [START] Скрипт запущен, инициализация...");

// [1] КОНФИГУРАЦИЯ
const API_TOKEN = process.env.BOT_TOKEN; 
const DOMAIN = process.env.DOMAIN || "np.bothost.ru"; 
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const WEB_APP_URL = `https://${DOMAIN}`;

// Безопасный путь для вебхука
const WEBHOOK_PATH = `/webhook-${API_TOKEN ? API_TOKEN.split(':')[0] : 'secret'}`; 

if (!API_TOKEN) {
    console.error("🛑 [FATAL ERROR] BOT_TOKEN не найден в переменных окружения!");
    process.exit(1);
}

const app = express();
const bot = new Telegraf(API_TOKEN);
let usersData = {};

// [2] БАЗА ДАННЫХ
function initDatabase() {
    console.log("3️⃣ [DB] Инициализация базы данных...");
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            try {
                usersData = raw.trim() ? JSON.parse(raw) : {};
                console.log(`✅ [DB] База загружена. Юзеров: ${Object.keys(usersData).length}`);
            } catch (parseErr) {
                console.error("⚠️ [DB] Ошибка парсинга JSON, создаю новую базу.");
                usersData = {};
            }
        } else {
            fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
            console.log("✅ [DB] Создан новый файл базы.");
        }
    } catch (e) { 
        console.error(`🚨 [DB ERROR] Ошибка: ${e.message}`); 
    }
}

// [3] MIDDLEWARE
app.use(express.json());
app.use(cors());

// Сначала обрабатываем вебхук от Telegram
app.use(bot.webhookCallback(WEBHOOK_PATH));

// Затем отдаем статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// [4] TELEGRAM БОТ
bot.start((ctx) => {
    ctx.reply(
        '🧠 Добро пожаловать в Neural Pulse AI!\n\nЖми кнопку ниже, чтобы начать играть и фармить токены.', 
        Markup.inlineKeyboard([
            Markup.button.webApp('🚀 Запустить игру', WEB_APP_URL)
        ])
    );
});

// [5] API ЭНДПОИНТЫ
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1, last_seen: Date.now() };
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    
    if (uid) {
        // Если юзера еще нет в памяти, создаем его
        if (!usersData[uid]) {
            usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1 };
        }
        
        usersData[uid].balance = Number(score);
        usersData[uid].energy = Number(energy);
        usersData[uid].last_seen = Date.now();
        
        fs.writeFile(DATA_FILE, JSON.stringify(usersData, null, 2), (err) => {
            if (err) console.error(`❌ [DB SAVE ERROR]:`, err);
        });
        
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// [7] ЗАПУСК СЕРВЕРА
async function boot() {
    initDatabase();
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🚀 [SERVER] Запущен на порту ${PORT}`);
        try {
            await bot.telegram.setWebhook(`${WEB_APP_URL}${WEBHOOK_PATH}`);
            console.log(`✅ [TELEGRAM] Webhook установлен на ${WEB_APP_URL}${WEBHOOK_PATH}`);
        } catch (whError) {
            console.error(`❌ [TELEGRAM ERROR] Ошибка вебхука: ${whError.message}`);
        }
    });
}

boot();
