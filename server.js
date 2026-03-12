const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

// [1] КОНФИГУРАЦИЯ
const BOT_TOKEN = "8257287930:AAFUmUinCAALPf6Bivpo04__Zp_V4Y49MFs";
const DOMAIN = "np.bothost.ru";
const PORT = process.env.PORT || 3000;

// ВСТАВЬ СЮДА ССЫЛКУ ИЗ ПАНЕЛИ BOTHOST (раздел Базы Данных)
const MONGO_URI = "mongodb://ТВОЯ_ССЫЛКА_ИЗ_ПАНЕЛИ_БАЗ_ДАННЫХ";

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

// Подключение к БД
mongoose.connect(MONGO_URI)
    .then(() => console.log("📦 [DB] Успешное подключение к MongoDB"))
    .catch(err => console.error("❌ [DB] Ошибка подключения к MongoDB:", err));

// [3] API ЭНДПОИНТЫ

// Получение данных пользователя
app.get('/api/user/:id', async (req, res) => {
    const uid = String(req.params.id);
    try {
        let user = await User.findOne({ userId: uid });
        if (!user) {
            user = await User.create({ userId: uid });
        }
        console.log(`📡 [GET] Данные отправлены для ID: ${uid}`);
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: "DB Error" });
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
                { new: true, upsert: true } // Создать, если нет
            );
            
            console.log(`☁️ [POST] Сохранено в БД ${uid}: 💰 ${updatedUser.balance.toFixed(2)}`);
            return res.json({ status: 'ok', data: updatedUser });
        } catch (e) {
            console.error("❌ [DB] Ошибка сохранения:", e);
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
            `Энергия: ⚡ <b>${user.energy}</b>`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('⚡ ИГРАТЬ', `https://${DOMAIN}`)]
            ])
        );
    } catch (e) {
        ctx.reply("Ошибка загрузки профиля. Попробуй позже.");
    }
});

// [5] ЗАПУСК
app.listen(PORT, () => {
    console.log(`\n————————————————————————————————————————————————`);
    console.log(`🖥️ СЕРВЕР: https://${DOMAIN}`);
    console.log(`📦 БАЗА ДАННЫХ: MongoDB Connected`);
    console.log(`⚠️ РЕЖИМ: PERSISTENT (Данные сохраняются навсегда)`);
    console.log(`————————————————————————————————————————————————\n`);
    
    bot.launch().then(() => {
        console.log(`✅ [BOT] Телеграм бот запущен`);
    }).catch(err => console.error("❌ Ошибка бота:", err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
