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

// --- БАЗА ДАННЫХ ЗАКОММЕНТИРОВАНА ---
// const mongoose = require('mongoose');
// const User = require('./models/User');
// const MONGO_URI = "mongodb+srv://..."; 

// Временное хранилище в памяти (сбросится при перезагрузке)
let tempUsers = {}; 

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [2] API ЭНДПОИНТЫ (РАБОТАЮТ ЧЕРЕЗ ПАМЯТЬ)
app.get('/api/user/:id', (req, res) => {
    const uid = String(req.params.id);
    if (!tempUsers[uid]) {
        tempUsers[uid] = { userId: uid, balance: 0, energy: 1000 };
    }
    res.json(tempUsers[uid]);
});

app.post('/api/save', (req, res) => {
    const { userId, balance, energy } = req.body;
    const uid = String(userId);
    if (uid) {
        tempUsers[uid] = { userId: uid, balance: Number(balance), energy: Number(energy) };
        return res.json({ status: 'success' });
    }
    res.status(400).json({ error: 'No user ID' });
});

// [3] ЛОГИКА БОТА
bot.start((ctx) => {
    const uid = String(ctx.from.id);
    console.log(`🎯 [BOT] Старт от ${ctx.from.first_name} (${uid})`);

    // Создаем профиль в памяти, если его нет
    if (!tempUsers[uid]) {
        tempUsers[uid] = { userId: uid, balance: 0, energy: 1000 };
    }

    ctx.replyWithHTML(
        `<b>🚀 NEURAL PULSE: ТЕСТОВЫЙ РЕЖИМ</b>\n\n` +
        `База данных временно отключена. Прогресс сохраняется только до перезагрузки бота.\n\n` +
        `Баланс: 💰 <b>${tempUsers[uid].balance} NP</b>`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]
        ])
    );
});

// [4] ЗАПУСК
app.listen(PORT, () => {
    console.log(`\n————————————————————————————————————————————————`);
    console.log(`🖥️  [SERVER] Работает на порту ${PORT}`);
    console.log(`⚠️  [STATUS] MongoDB отключена (используется RAM)`);
    console.log(`————————————————————————————————————————————————\n`);
    
    bot.launch().catch(err => console.error("❌ Ошибка запуска бота:", err));
});

// Защита от корректного завершения
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
