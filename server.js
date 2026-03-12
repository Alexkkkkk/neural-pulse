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

// Временное хранилище в оперативной памяти
let tempUsers = {}; 

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [2] API ЭНДПОИНТЫ

// Получение данных пользователя (при входе в игру)
app.get('/api/user/:id', (req, res) => {
    const uid = String(req.params.id);
    
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

// Сохранение прогресса (при тапах)
app.post('/api/save', (req, res) => {
    const { userId, user_id, balance, energy, click_lvl, pnl } = req.body;
    const uid = String(userId || user_id);

    if (uid && uid !== "undefined" && uid !== "null") {
        // Если пользователя нет, создаем структуру
        if (!tempUsers[uid]) {
            tempUsers[uid] = { userId: uid, balance: 0, energy: 1000, click_lvl: 1, pnl: 0 };
        }

        // Обновляем данные (используем проверку на undefined, чтобы не потерять 0)
        if (balance !== undefined) tempUsers[uid].balance = Number(balance);
        if (energy !== undefined) tempUsers[uid].energy = Number(energy);
        if (click_lvl !== undefined) tempUsers[uid].click_lvl = Number(click_lvl);
        if (pnl !== undefined) tempUsers[uid].pnl = Number(pnl);
        
        console.log(`☁️  [POST] Сохранено ${uid}: 💰 ${tempUsers[uid].balance} | ⚡ ${tempUsers[uid].energy}`);
        return res.json({ status: 'ok', data: tempUsers[uid] });
    }
    
    console.error("❌ [POST] Ошибка: ID пользователя не получен", req.body);
    res.status(400).json({ error: 'Invalid User ID' });
});

// [3] ЛОГИКА ТЕЛЕГРАМ-БОТА
bot.start((ctx) => {
    const uid = String(ctx.from.id);
    const name = ctx.from.first_name || "User";

    if (!tempUsers[uid]) {
        tempUsers[uid] = { userId: uid, balance: 0, energy: 1000, click_lvl: 1, pnl: 0 };
    }

    ctx.replyWithHTML(
        `<b>🚀 NEURAL PULSE AI: ОНЛАЙН</b>\n\n` +
        `Привет, ${name}!\n` +
        `Твой баланс: 💰 <b>${Math.floor(tempUsers[uid].balance).toLocaleString()} NP</b>\n` +
        `Твой уровень клика: ⚡ <b>${tempUsers[uid].click_lvl}</b>`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]
        ])
    );
});

// [4] ЗАПУСК
app.listen(PORT, () => {
    console.log(`\n————————————————————————————————————————————————`);
    console.log(`🖥️  СЕРВЕР ЗАПУЩЕН: https://${DOMAIN}`);
    console.log(`📡  API ПОРТ: ${PORT}`);
    console.log(`⚠️  РЕЖИМ: Хранение в RAM (Данные сбросятся при рестарте)`);
    console.log(`————————————————————————————————————————————————\n`);
    
    bot.launch().catch(err => console.error("❌ Ошибка бота:", err));
});

// Безопасное завершение работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
