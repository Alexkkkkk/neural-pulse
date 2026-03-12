const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

// [1] КОНФИГУРАЦИЯ
const BOT_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs";
const DOMAIN = "np.bothost.ru";
const PORT = process.env.PORT || 3000;

// Твоя ссылка с твоим паролем
const MONGO_URI = "mongodb+srv://Kander:kander3132001574@kander.dwhwmf0.mongodb.net/NeuralPulse?retryWrites=true&w=majority&appName=Kander";

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [2] МОДЕЛЬ ДАННЫХ (MongoDB)
const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true, required: true },
    balance: { type: Number, default: 0 },
    energy: { type: Number, default: 1000 },
    click_lvl: { type: Number, default: 1 },
    pnl: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// Подключение к БД с увеличенным временем ожидания
mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000 
})
    .then(() => console.log("📦 [DB] Успешное подключение к MongoDB Atlas"))
    .catch(err => {
        console.error("❌ [DB] Ошибка подключения!");
        console.error("Проверь Network Access в MongoDB Atlas (должно быть 0.0.0.0/0)");
        console.error(err.message);
    });

// [3] API ЭНДПОИНТЫ

// Получение данных пользователя
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    if (!uid || uid === "null" || uid === "undefined") return res.status(400).json({ error: "Invalid ID" });
    
    try {
        let user = await User.findOne({ userId: uid });
        if (!user) {
            user = await User.create({ userId: uid });
            console.log(`🆕 [DB] Новый игрок создан: ${uid}`);
        }
        res.json(user);
    } catch (e) {
        console.error("❌ [API GET] Ошибка базы:", e.message);
        res.status(500).json({ error: "Database error" });
    }
});

// Сохранение прогресса
app.post('/api/save', async (req, res) => {
    const { userId, balance, energy, click_lvl, pnl } = req.body;
    const uid = String(userId);

    if (uid && uid !== "undefined" && uid !== "null") {
        try {
            const updatedUser = await User.findOneAndUpdate(
                { userId: uid },
                { 
                    $set: { 
                        balance: parseFloat(balance) || 0,
                        energy: parseInt(energy) || 0,
                        click_lvl: parseInt(click_lvl) || 1,
                        pnl: parseFloat(pnl) || 0
                    } 
                },
                { new: true, upsert: true }
            );
            
            // Логируем редко, чтобы не спамить
            if (Math.random() > 0.9) {
                console.log(`☁️ [DB SAVE] Прогресс сохранен для ${uid}`);
            }
            return res.json({ status: 'ok', data: updatedUser });
        } catch (e) {
            console.error("❌ [DB SAVE] Ошибка сохранения:", e.message);
            return res.status(500).json({ error: "Save Error" });
        }
    }
    res.status(400).json({ error: 'Invalid User ID' });
});

// [4] ЛОГИКА ТЕЛЕГРАМ-БОТА
bot.start(async (ctx) => {
    const uid = String(ctx.from.id);
    const name = ctx.from.first_name || "Игрок";

    try {
        let user = await User.findOne({ userId: uid });
        if (!user) user = await User.create({ userId: uid });

        ctx.replyWithHTML(
            `<b>🚀 NEURAL PULSE AI: ОНЛАЙН</b>\n\n` +
            `Привет, ${name}!\n` +
            `Твой баланс: 💰 <b>${Math.floor(user.balance).toLocaleString()} NP</b>\n` +
            `Энергия: ⚡ <b>${Math.floor(user.energy)}</b>\n\n` +
            `<i>Данные в безопасности на серверах Atlas 🛡️</i>`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]
            ])
        );
    } catch (e) {
        console.error("❌ [BOT START] Ошибка:", e.message);
        ctx.reply("⚠️ Проблемы с базой данных. Попробуйте через минуту.");
    }
});

// [5] ЗАПУСК
app.listen(PORT, () => {
    console.log(`\n————————————————————————————————————————————————`);
    console.log(`🖥️  СЕРВЕР: https://${DOMAIN}`);
    console.log(`📦 БАЗА: MongoDB Atlas (Persistent)`);
    console.log(`————————————————————————————————————————————————\n`);
    
    bot.launch().then(() => {
        console.log(`✅ [BOT] Телеграм бот запущен`);
    }).catch(err => console.error("❌ Ошибка запуска бота:", err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
