const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');

// [1] КОНФИГУРАЦИЯ
const BOT_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs";
const DOMAIN = "np.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Временное хранилище в оперативной памяти (сбросится при перезагрузке сервера)
let tempUsers = {}; 

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [2] API ЭНДПОИНТЫ

// Получение данных (вызывается при загрузке игры)
app.get('/api/user/:id', (req, res) => {
    const uid = String(req.params.id);
    
    if (!tempUsers[uid]) {
        // Начальное состояние нового игрока
        tempUsers[uid] = { 
            userId: uid, 
            balance: 0, 
            energy: 1000,
            click_lvl: 1,
            pnl: 0 
        };
    }
    
    console.log(`📡 [GET] Данные игрока ${uid} отправлены`);
    res.json(tempUsers[uid]);
});

// Сохранение данных (вызывается из игры каждые 4 сек или при клике)
app.post('/api/save', (req, res) => {
    const { userId, balance, energy } = req.body;
    const uid = String(userId);

    if (uid && tempUsers[uid]) {
        // Сохраняем значения, форсируя тип Number, чтобы не было ошибок в математике
        tempUsers[uid].balance = Number(balance);
        tempUsers[uid].energy = Number(energy);
        
        console.log(`☁️  [POST] Сохранено ${uid}: 💰 ${balance} | ⚡ ${energy}`);
        return res.json({ status: 'success' });
    }
    
    res.status(400).json({ error: 'User not found' });
});

// [3] ЛОГИКА ТЕЛЕГРАМ-БОТА
bot.start((ctx) => {
    const uid = String(ctx.from.id);
    const firstName = ctx.from.first_name || "User";

    if (!tempUsers[uid]) {
        tempUsers[uid] = { userId: uid, balance: 0, energy: 1000, click_lvl: 1, pnl: 0 };
    }

    ctx.replyWithHTML(
        `<b>🚀 Привет, ${firstName}! Добро пожаловать в Neural Pulse</b>\n\n` +
        `Твой текущий баланс: 💰 <b>${Math.floor(tempUsers[uid].balance)} NP</b>\n` +
        `Энергия: ⚡ <b>${Math.floor(tempUsers[uid].energy)}</b>\n\n` +
        `<i>Нажми кнопку ниже, чтобы начать майнинг:</i>`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]
        ])
    );
});

// [4] ЗАПУСК
app.listen(PORT, () => {
    console.log(`\n————————————————————————————————————————————————`);
    console.log(`🖥️  СЕРВЕР: https://${DOMAIN}`);
    console.log(`📡  API: http://localhost:${PORT}/api/user/`);
    console.log(`⚠️  БАЗА: MongoDB ОТКЛЮЧЕНА (данные в RAM)`);
    console.log(`————————————————————————————————————————————————\n`);
    
    bot.launch().catch(err => console.error("❌ Ошибка бота:", err));
});

// Безопасное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
