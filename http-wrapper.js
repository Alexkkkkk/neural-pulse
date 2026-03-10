const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');
const { Telegraf, Markup } = require('telegraf');

// --- [КОНФИГУРАЦИЯ] ---
const API_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs"; 
const WEB_APP_URL = "https://np.bothost.ru";
const PORT = 3000;
const ADMIN_ID = 476014374; 

const app = express();
const bot = new Telegraf(API_TOKEN);

// --- [БАЗА ДАННЫХ] ---
const DATA_FILE = path.join(__dirname, 'data', 'users.json');
let usersData = {};
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (fs.existsSync(DATA_FILE)) usersData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');

const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));

// --- [API & MIDDLEWARE] ---
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'static')));

app.get('/api/balance/:userId', (req, res) => {
    const uid = String(req.params.userId);
    res.json({ status: "ok", data: usersData[uid] || { balance: 0, energy: 1000 } });
});

app.post('/api/save', (req, res) => {
    const { user_id, score, energy } = req.body;
    if (user_id) {
        usersData[user_id] = { balance: score, energy };
        save();
    }
    res.json({ status: "ok" });
});

// --- [КОМАНДЫ БОТА] ---
bot.start((ctx) => ctx.replyWithHTML(`🦾 <b>NEURAL PULSE</b>`, 
    Markup.inlineKeyboard([[Markup.button.webApp("ИГРАТЬ", `${WEB_APP_URL}/?u=${ctx.from.id}`)]])));

bot.command('admin_reset', (ctx) => {
    if (ctx.from.id === ADMIN_ID) { usersData = {}; save(); ctx.reply("БД очищена"); }
});

bot.command('admin_pull', (ctx) => {
    if (ctx.from.id === ADMIN_ID) {
        exec('git pull', (err) => ctx.reply(err ? "Ошибка" : "Обновлено, перезапустите бот"));
    }
});

// --- [ЗАПУСК С ПРОВЕРКОЙ ПОРТА] ---
const startServer = () => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Бот успешно занял порт ${PORT}`);
        bot.telegram.setWebhook(`${WEB_APP_URL}/webhook-tg`).catch(console.error);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log("⚠️ Порт занят заглушкой. Перезапуск через 2 сек...");
            setTimeout(() => process.exit(1), 2000); // PM2 перезапустит нас
        }
    });
};

app.post('/webhook-tg', (req, res) => bot.handleUpdate(req.body, res));

startServer();
