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

// Временное хранилище в RAM
let tempUsers = {}; 

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [2] API ЭНДПОИНТЫ

// Получение данных пользователя
app.get('/api/user/:id', (req, res) => {
    const uid = String(req.params.id);
    
    // Если пользователя нет, создаем дефолтный профиль
    if (!tempUsers[uid]) {
        tempUsers[uid] = { 
            userId: uid, 
            balance: 0, 
            energy: 1000,
            click_lvl: 1,
            pnl: 0 
        };
    }
    
    console.log(`📡 [GET] Данные отправлены для ID: ${uid}`);
    res.json(tempUsers[uid]);
});

// Сохранение прогресса
app.post('/api/save', (req, res) => {
    const { userId, user_id, balance, energy, click_lvl, pnl } = req.body;
    const uid = String(userId || user_id);

    // Проверка на валидность ID
    if (uid && uid !== "undefined" && uid !== "null") {
        if (!tempUsers[uid]) {
            tempUsers[uid] = { userId: uid, balance: 0, energy: 1000, click_lvl: 1, pnl: 0 };
        }

        // Обновляем данные с защитой от пустых строк и NaN
        if (balance !== undefined) tempUsers[uid].balance = parseFloat(balance) || 0;
        if (energy !== undefined) tempUsers[uid].energy = parseInt(energy) || 0;
        if (click_lvl !== undefined) tempUsers[uid].click_lvl = parseInt(click_lvl) || 1;
        if (pnl !== undefined) tempUsers[uid].pnl = parseFloat(pnl) || 0;
        
        console.log(`☁️  [POST] Обновлено ${uid}: 💰 ${tempUsers[uid].balance.toFixed(2)} | ⚡ ${tempUsers[uid].energy}`);
        return res.json({ status: 'ok', data: tempUsers[uid] });
    }
    
    console.error("❌ [POST] Ошибка: Тело запроса пустое или ID не валиден", req.body);
    res.status(400).json({ error: 'Invalid User ID' });
});

// [3] ЛОГИКА ТЕЛЕГРАМ-БОТА
bot.start((ctx) => {
    const uid = String(ctx.from.id);
    const name = ctx.from.first_name || "Игрок";

    if (!tempUsers[uid]) {
        tempUsers[uid] = { userId: uid, balance: 0, energy: 1000, click_lvl: 1, pnl: 0 };
    }

    ctx.replyWithHTML(
        `<b>🚀 NEURAL PULSE AI: ОНЛАЙН</b>\n\n` +
        `Привет, ${name}!\n` +
        `Твой баланс: 💰 <b>${Math.floor(tempUsers[uid].balance).toLocaleString()} NP</b>\n` +
        `Энергия: ⚡ <b>${tempUsers[uid].energy}</b>`,
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
    console.log(`⚠️  РЕЖИМ: RAM (Данные обнулятся при перезагрузке)`);
    console.log(`————————————————————————————————————————————————\n`);
    
    bot.launch().then(() => {
        console.log(`✅ [BOT] Телегрaм бот запущен`);
    }).catch(err => console.error("❌ Ошибка бота:", err));
});

// Безопасное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
