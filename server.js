const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const User = require('./models/User'); 

// [1] КОНФИГУРАЦИЯ
const BOT_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs";

// !!! ЗАМЕНИ ЭТУ СТРОКУ НА СВОЮ ИЗ MONGODB ATLAS !!!
// Обязательно проверь, чтобы пароль был вписан вместо <password>
const MONGO_URI = "mongodb+srv://admin:ТВОЙ_ПАРОЛЬ@cluster0.abcde.mongodb.net/neuralpulse?retryWrites=true&w=majority";

const DOMAIN = "np.bothost.ru";
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// [2] ПРАВИЛЬНОЕ ПОДКЛЮЧЕНИЕ К БАЗЕ
mongoose.set('strictQuery', false);
const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000 // Не ждем дольше 5 секунд
        });
        console.log("💎 [DB] Успешно подключено к MongoDB Atlas!");
    } catch (err) {
        console.error("🚨 [DB] Ошибка подключения! Скорее всего, неверная ссылка или пароль.");
        console.error("Детали:", err.message);
    }
};

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [3] API ЭНДПОИНТЫ
app.get('/api/user/:id', async (req, res) => {
    try {
        let user = await User.findOne({ userId: req.params.id });
        if (!user) {
            user = await User.create({ userId: req.params.id });
        }
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/save', async (req, res) => {
    try {
        const { userId, balance, energy } = req.body;
        await User.findOneAndUpdate({ userId }, { balance, energy, lastSync: Date.now() });
        res.json({ status: 'success' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// [4] ЛОГИКА БОТА
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const refId = ctx.startPayload;

    try {
        let user = await User.findOne({ userId: uid });
        if (!user) {
            user = await User.create({ userId: uid, referredBy: refId || null });
            if (refId) {
                await User.findOneAndUpdate({ userId: refId }, { $inc: { balance: 5000, friendsCount: 1 } });
            }
        }

        ctx.replyWithHTML(
            `<b>🚀 NEURAL PULSE: СИСТЕМА ГОТОВА</b>\n\nБаланс: 💰 <b>${user.balance} NP</b>`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]
            ])
        );
    } catch (e) {
        console.error("Ошибка в /start:", e);
        ctx.reply("⚠️ Ошибка подключения к базе данных. Попробуйте позже.");
    }
});

// [5] ЗАПУСК
app.listen(PORT, () => {
    console.log(`🖥️ [SERVER] Работает на порту ${PORT}`);
    bot.launch().then(() => console.log(`✅ [BOT] Бот запущен (Long Polling)`));
});
