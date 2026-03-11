const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const User = require('./models/User'); // Путь к модели

// [1] КОНФИГУРАЦИЯ
const BOT_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs";
const MONGO_URI = "mongodb+srv://admin:твои_пароль@cluster.mongodb.net/neuralpulse"; // ТУТ НУЖНА ТВОЯ ССЫЛКА
const DOMAIN = "np.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// [2] ПОДКЛЮЧЕНИЕ К БАЗЕ
mongoose.connect(MONGO_URI)
    .then(() => console.log("💎 [DB] Connected to MongoDB (Scalable)"))
    .catch(err => console.error("🚨 [DB] Connection Error:", err));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [3] API ДЛЯ ИГРЫ (Оптимизировано под миллионы юзеров)
app.get('/api/user/:id', async (req, res) => {
    let user = await User.findOne({ userId: req.params.id });
    if (!user) {
        user = await User.create({ userId: req.params.id });
    }
    res.json(user);
});

app.post('/api/save', async (req, res) => {
    const { userId, balance, energy } = req.body;
    await User.findOneAndUpdate({ userId }, { balance, energy, lastSync: Date.now() });
    res.json({ status: 'success' });
});

// [4] ЛОГИКА БОТА С РЕФЕРАЛКОЙ (Путь к 20 млн)
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const refId = ctx.startPayload; // ID того, кто пригласил

    let user = await User.findOne({ userId: uid });

    if (!user) {
        user = await User.create({ 
            userId: uid, 
            username: ctx.from.username,
            referredBy: refId || null 
        });

        // Бонус пригласившему
        if (refId) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { balance: 5000, friendsCount: 1 } });
        }
    }

    const shareLink = `https://t.me/neural_pulse_bot?start=${uid}`;
    
    ctx.replyWithHTML(
        `<b>🚀 NEURAL PULSE: ВХОД ВЫПОЛНЕН</b>\n\n` +
        `Твой баланс: 💰 <b>${user.balance} NP</b>\n` +
        `Приглашено друзей: 👥 <b>${user.friendsCount}</b>\n\n` +
        `За каждого друга даем 5,000 NP!`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)],
            [Markup.button.switchToChat('📢 Пригласить друга', `Играй со мной в Neural Pulse! 💎`)]
        ])
    );
});

// [5] ЗАПУСК
app.listen(PORT, () => {
    console.log(`🖥️ [SERVER] Web App on port ${PORT}`);
    bot.launch();
    console.log(`✅ [BOT] Long Polling started`);
});
