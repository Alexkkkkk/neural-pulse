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

// Временное хранилище в оперативной памяти (сбросится при перезагрузке)
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
    // Принимаем данные. Добавлена проверка разных стилей написания ID
    const { userId, user_id, balance, energy } = req.body;
    const uid = String(userId || user_id);

    if (uid && uid !== "undefined" && uid !== "null") {
        if (!tempUsers[uid]) {
            tempUsers[uid] = { userId: uid, click_lvl: 1, pnl: 0 };
        }

        // Обновляем баланс и энергию, принудительно преобразуя в числа
        tempUsers[uid].balance = Number(balance) || tempUsers[uid].balance;
        tempUsers[uid].energy = Number(energy) || 0;
        
        console.log(`☁️  [POST] Сохранено ${uid}: 💰 ${tempUsers[uid].balance} | ⚡ ${energy}`);
        return res.json({ status: 'ok' });
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
        `Твой баланс: 💰 <b>${Math.floor(tempUsers[uid].balance)} NP</b>`,
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
    console.log(`⚠️  РЕЖИМ: Хранение в RAM (без БД)`);
    console.log(`————————————————————————————————————————————————\n`);
    
    bot.launch().catch(err => console.error("❌ Ошибка бота:", err));
});

// Безопасное завершение работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
