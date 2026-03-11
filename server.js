const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios'); // Добавили для работы с Bothost API

// [1] ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (из документации Bothost)
const API_TOKEN = process.env.BOT_TOKEN; // Автоматически берется из настроек Bothost
const DOMAIN = process.env.DOMAIN || "np.bothost.ru";
const PORT = process.env.PORT || 3000;
const BOT_ID = process.env.BOT_ID;
const AGENT_URL = process.env.BOTHOST_AGENT_URL || 'http://agent:8000';

if (!API_TOKEN) {
    console.error('❌ ОШИБКА: BOT_TOKEN не найден в переменных окружения!');
    process.exit(1);
}

const WEB_APP_URL = `https://${DOMAIN}`;
const WEBHOOK_PATH = "/webhook-tg-pulse";

const app = express();
const bot = new Telegraf(API_TOKEN);

// [2] БАЗА ДАННЫХ
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
let usersData = {};

function initDB() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
        try {
            usersData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) { usersData = {}; }
    }
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));
}

// [3] MIDDLEWARE
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// [4] ЛОГИКА БОТА
bot.start((ctx) => {
    const uid = ctx.from.id;
    if (!usersData[uid]) {
        usersData[uid] = { id: uid, balance: 0, energy: 1000, max_energy: 1000, click_lvl: 1, pnl: 0 };
        saveData();
    }
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE ONLINE</b>`, 
        Markup.inlineKeyboard([[
            Markup.button.webApp("ВХОД В СИСТЕМУ 🧠", `${WEB_APP_URL}/?u=${uid}`)
        ]])
    );
});

// СЕКРЕТНАЯ КОМАНДА ПЕРЕЗАГРУЗКИ (из API Reference)
bot.command('restart_system', async (ctx) => {
    if (!BOT_ID) return ctx.reply("❌ BOT_ID не определен");
    
    await ctx.reply("🔄 Инициирую самоперезапуск контейнера...");
    try {
        await axios.post(`${AGENT_URL}/api/bots/self/restart`, {}, {
            headers: { 'X-Bot-ID': BOT_ID }
        });
    } catch (e) {
        ctx.reply(`Ошибка API: ${e.message}`);
    }
});

// [5] API ДЛЯ MINI APP
app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    res.json({ status: "ok", data: usersData[uid] || { id: uid, balance: 0 } });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    if (user_id && usersData[user_id]) {
        usersData[user_id].balance = Number(score);
        usersData[user_id].energy = Number(energy);
        saveData();
        return res.json({ status: "ok" });
    }
    res.sendStatus(400);
});

// Вебхук
app.post(WEBHOOK_PATH, (req, res) => bot.handleUpdate(req.body, res));

// [6] БУТСТРАП
async function boot() {
    initDB();
    try {
        await bot.telegram.setWebhook(`${WEB_APP_URL}${WEBHOOK_PATH}`);
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ [SYSTEM ONLINE] Port: ${PORT}`);
        });
    } catch (e) {
        console.error(`🛑 Ошибка запуска: ${e.message}`);
    }
}

boot();
