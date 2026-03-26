import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs'; 
import { createProxyMiddleware } from 'http-proxy-middleware';
import { User, Task, Stats } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";
const PORT = process.env.PORT || 3000;

logger.info(`[BOT_INIT] Запуск на порту ${PORT}...`);

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// 1. ПЕРЕХВАТЧИК ВЕБХУКА (Самый высокий приоритет)
// Ставим ПЕРЕД express.json(), чтобы не было конфликтов с body-parser
app.post(`/telegraf/${BOT_TOKEN}`, (req, res) => {
    logger.info(`[TG_WEBHOOK] >>> Входящий POST от Telegram`);
    
    // МГНОВЕННЫЙ ОТВЕТ (Убирает 504 Gateway Timeout)
    // Мы говорим Telegram "OK", а Telegraf обработает логику в фоне
    res.status(200).send('OK'); 

    // Передаем запрос в Telegraf вручную
    bot.handleUpdate(req.body);
});

// 2. MIDDLEWARE (Только после вебхука!)
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

// Логгер для отладки API и Прокси
app.use((req, res, next) => {
    if (!req.url.includes('telegraf')) {
        logger.info(`[HTTP_REQ] ${req.method} ${req.url} from ${req.ip}`);
    }
    next();
});

// 3. УЛУЧШЕННЫЙ ПРОКСИ ДЛЯ АДМИНКИ
app.use('/admin', createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    ws: true,
    onProxyReq: (proxyReq, req) => logger.info(`[PROXY] Переход в админку: ${req.url}`),
    onError: (err, req, res) => {
        logger.warn(`[PROXY_FAIL] AdminJS (3001) не отвечает. Причина: ${err.message}`);
        res.status(502).set('Content-Type', 'text/html').send(`
            <div style="background:#05070a; color:#00f2fe; padding:40px; font-family:monospace; border:2px solid #00f2fe; max-width:600px; margin:50px auto; text-align:center;">
                <h2>> SYSTEM_ERROR: ADMIN_OFFLINE</h2>
                <p style="color:#ff3366;">[!] Сервер AdminJS еще не готов или упал.</p>
                <p>Подождите 30-60 секунд и попробуйте снова.</p>
                <button onclick="location.reload()" style="background:#00f2fe; color:black; padding:10px; font-weight:bold; cursor:pointer;">ПЕРЕПОДКЛЮЧИТЬСЯ</button>
            </div>
        `);
    }
}));

// 4. ЛОГИКА БОТА
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    logger.info(`[BOT_CMD] Пользователь ${userId} отправил /start`);
    
    try {
        // Логируем начало работы с БД
        logger.info(`[DB_QUERY] Поиск пользователя ${userId}...`);
        
        const [user, created] = await User.findOrCreate({ 
            where: { id: BigInt(userId) },
            defaults: { 
                username: ctx.from.username || 'AGENT',
                balance: 0
            }
        });

        logger.info(`[DB_RES] Пользователь ${userId}: ${created ? 'СОЗДАН' : 'НАЙДЕН'}`);

        const keyboard = Markup.inlineKeyboard([[
            Markup.button.webApp("⚡ ТЕРМИНАЛ", DOMAIN)
        ]]);

        await ctx.reply(`<b>Neural Pulse: Online</b>\n\nАгент: <code>${user.username}</code>\nСтатус: <b>CONNECTED</b>`, {
            parse_mode: 'HTML',
            ...keyboard
        });
        
        logger.info(`[BOT_SEND] Ответ пользователю ${userId} отправлен.`);
    } catch (e) {
        logger.error(`[BOT_FATAL] Критическая ошибка в /start: ${e.message}`);
    }
});

// 5. ЗАПУСК
const startListening = () => {
    app.listen(PORT, '0.0.0.0', () => {
        logger.system(`══════════════════════════════════════════════════`);
        logger.system(`📡 GATEWAY ONLINE: Port ${PORT}`);
        logger.system(`🔗 DOMAIN: ${DOMAIN}`);
        logger.system(`══════════════════════════════════════════════════`);
    }).on('error', (err) => {
        logger.error(`[SERVER_ERR] Порт ${PORT} занят? Ошибка: ${err.message}`);
    });
};

startListening();
