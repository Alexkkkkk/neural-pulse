const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

// [1] КОНФИГУРАЦИЯ ИЗ ОКРУЖЕНИЯ
const API_TOKEN = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN || "np.bothost.ru";
const PORT = process.env.PORT || 3000;

// ВАЖНО: Путь /app/data согласно мануалу Bothost для персистентности
const DATA_DIR = "/app/data"; 
const DATA_FILE = path.join(DATA_DIR, 'users.json');

const WEB_APP_URL = `https://${DOMAIN}`;
const WEBHOOK_PATH = "/webhook-tg-pulse";

const app = express();
const bot = new Telegraf(API_TOKEN);

let usersData = {};

// [2] БАЗА ДАННЫХ (Программное создание по мануалу)
function initDatabase() {
    try {
        // Создаем папку /app/data если её нет
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            console.log("📁 Папка /app/data создана");
        }
        
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            usersData = raw.trim() ? JSON.parse(raw) : {};
            console.log(`📂 БД загружена: ${Object.keys(usersData).length} юзеров`);
        } else {
            usersData = {};
            fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
            console.log("📄 Файл users.json инициализирован");
        }
    } catch (e) { console.error(`🚨 [DB ERROR] ${e.message}`); }
}

function saveData() {
    try {
        // Используем временный файл для безопасной записи (атомарно)
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(usersData, null, 2));
        fs.renameSync(tmp, DATA_FILE); 
    } catch (e) { console.error(`💾 [SAVE ERROR] ${e.message}`); }
}

// [3] MIDDLEWARE & СТАТИКА
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// [4] ЛОГИКА БОТА
bot.start((ctx) => {
    const uid = String(ctx.from.id);
    if (!usersData[uid]) {
        usersData[uid] = { 
            id: uid, balance: 0, energy: 1000, max_energy: 1000, 
            click_lvl: 1, pnl: 0, last_seen: Date.now() 
        };
        saveData();
    }
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE ONLINE</b>`, 
        Markup.inlineKeyboard([[
            Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", `${WEB_APP_URL}/?u=${uid}`)
        ]])
    );
});

// [5] API ДЛЯ MINI APP
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1, pnl: 0 };
        saveData();
    }
    res.json({ status: "ok", data: usersData[uid] });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    const uid = String(user_id);
    if (uid && usersData[uid]) {
        usersData[uid].balance = Number(score);
        usersData[uid].energy = Number(energy);
        usersData[uid].last_seen = Date.now();
        saveData();
        return res.json({ status: "ok" });
    }
    res.status(400).json({ status: "error" });
});

// Вебхук
app.post(WEBHOOK_PATH, (req, res) => bot.handleUpdate(req.body, res));

// [6] ЗАПУСК
async function boot() {
    initDatabase();
    try {
        await bot.telegram.setWebhook(`${WEB_APP_URL}${WEBHOOK_PATH}`);
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ [SYSTEM ONLINE] Port: ${PORT}`);
        });
    } catch (e) { console.error(`🛑 BOOT ERROR: ${e.message}`); }
}

boot();
