import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Тест доступности порта
app.get('/test', (req, res) => res.send("<h1>SERVER IS ALIVE!</h1>"));

// Логика бота
bot.start(async (ctx) => {
    console.log(`[!] ВЫПОЛНЯЮ ОТВЕТ НА /START ДЛЯ ${ctx.from.id}`);
    try {
        await ctx.reply("Система Neural Pulse: СВЯЗЬ УСТАНОВЛЕНА!");
    } catch (e) {
        console.error("Ошибка ctx.reply:", e.message);
    }
});

// Обработчик Webhook
app.post('/', async (req, res) => {
    console.log("📥 [POST] Запрос от Telegram получен");
    res.sendStatus(200); // Сразу отвечаем 200 OK
    try {
        await bot.handleUpdate(req.body);
    } catch (err) {
        console.error("Ошибка handleUpdate:", err.message);
    }
});

// Запуск с задержкой для стабильности на Bothost
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Шаг 1: Сервер слушает порт ${PORT}`);
    
    // Задержка 2 секунды, чтобы Express успел "прогреться"
    setTimeout(async () => {
        try {
            console.log("🚀 Шаг 2: Удаление старых данных...");
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            
            console.log("🚀 Шаг 3: Установка нового Webhook...");
            const success = await bot.telegram.setWebhook(`${DOMAIN}/`);
            
            if (success) {
                console.log(`✅ СИСТЕМА ГОТОВА: ${DOMAIN}/`);
            } else {
                console.error("❌ Telegram отклонил установку Webhook");
            }
        } catch (err) {
            console.error("❌ КРИТИЧЕСКАЯ ОШИБКА НАСТРОЙКИ:", err.message);
        }
    }, 2000);
});
