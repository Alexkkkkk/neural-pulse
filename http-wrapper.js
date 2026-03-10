const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');
const { Telegraf, Markup } = require('telegraf');

const API_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = 3000;
const ADMIN_ID = 476014374; 

const app = express();
const bot = new Telegraf(API_TOKEN);

// --- [БАЗА ДАННЫХ] ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DATA_FILE = path.join(DATA_DIR, 'users.json');
let usersData = {};
try {
    if (fs.existsSync(DATA_FILE)) usersData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
} catch (e) { console.error("Ошибка БД:", e); }

const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));

// --- [API] ---
app.use(express.json());
app.use(cors());

// Обработка вебхука от Telegram
app.post('/webhook-tg', (req, res) => {
    console.log("📩 Получено обновление от TG");
    bot.handleUpdate(req.body, res);
});

app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    res.json({ status: "ok", data: usersData[uid] || { balance: 0, energy: 1000 } });
});

// --- [ЛОГИКА БОТА] ---
bot.start((ctx) => {
    console.log(`🚀 Команда /start от ${ctx.from.id}`);
    ctx.replyWithHTML(`🦾 <b>NEURAL PULSE AI</b>\n\nСистема активна!`, 
    Markup.inlineKeyboard([[Markup.button.webApp("ИГРАТЬ 🧠", `${WEB_APP_URL}/?u=${ctx.from.id}`)]]));
});

// Команда для проверки, жив ли бот (через Polling, если вебхук падает)
bot.command('ping', (ctx) => ctx.reply('pong'));

// --- [ЗАПУСК] ---
const start = async () => {
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`✅ Сервер на порту ${PORT}`);
        try {
            const hookPath = `${WEB_APP_URL}/webhook-tg`;
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(hookPath);
            console.log(`🤖 Вебхук установлен на: ${hookPath}`);
        } catch (e) {
            console.error("❌ Ошибка вебхука:", e.message);
        }
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log("⚠️ Порт занят, перезапуск...");
            setTimeout(() => process.exit(1), 1000);
        }
    });
};

start();
