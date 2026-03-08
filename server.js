const express = require('express');
const http = require('http');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { Server } = require('socket.io');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf'); // Добавили Telegraf

// --- [КОНФИГУРАЦИЯ] ---
const API_TOKEN = "8257287930:AAFdsn-kKHnq1yJK6Pbg38iQdGet7S9lOUM";
const WEB_APP_URL = "https://np.bothost.ru"; // Твой URL

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const bot = new Telegraf(API_TOKEN);

app.use(cors());
app.use(express.json());

// Раздаем статику: index.html лежит в /static
app.use('/static', express.static(path.join(__dirname, 'static')));

let db;

// --- [ИНИЦИАЛИЗАЦИЯ БД] ---
async function initDB() {
    // Убедись, что папка 'data' существует в корне проекта
    db = await open({
        filename: path.join(__dirname, 'data', 'game.db'),
        driver: sqlite3.Database
    });
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, 
        balance REAL, 
        click_lvl INTEGER, 
        pnl REAL DEFAULT 0, 
        energy REAL, 
        max_energy INTEGER, 
        level INTEGER DEFAULT 1, 
        last_active INTEGER)`);
    console.log("💾 Database & Tables Ready");
}

// --- [ЛОГИКА ТЕЛЕГРАМ БОТА] ---
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    try {
        // Приветственное сообщение с кнопкой WebApp
        await ctx.replyWithHTML(
            `🦾 <b>Neural Pulse: Протокол Запущен</b>\n\nДобро пожаловать в систему, нейро-майнер!`,
            Markup.inlineKeyboard([
                [Markup.button.webApp("ВХОД В НЕЙРОСЕТЬ 🧠", `${WEB_APP_URL}/?u=${uid}`)],
                [Markup.button.url("КАНАЛ ПРОЕКТА 📢", "https://t.me/neural_pulse")]
            ])
        );
    } catch (e) {
        console.error("Ошибка бота при старте:", e);
    }
});

// --- [API ЭНДПОИНТЫ] ---
app.get('/api/balance/:userId', async (req, res) => {
    try {
        if (!db) return res.status(503).send("Database not ready");
        
        const userId = String(req.params.userId);
        const now = Math.floor(Date.now() / 1000);
        let user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (user) {
            const offTime = Math.min(now - (user.last_active || now), 10800);
            const earned = (user.pnl / 3600) * offTime;
            res.json({ status: "ok", data: {
                score: user.balance + earned, 
                tap_power: user.click_lvl,
                pnl: user.pnl, 
                energy: user.energy, 
                level: user.level,
                max_energy: user.max_energy, 
                multiplier: 1
            }});
        } else {
            // Регистрация нового игрока
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, 1000, 1, 0, 1000, 1000, 1, ?)`, [userId, now]);
            res.json({ status: "ok", data: { score: 1000, tap_power: 1, pnl: 0, energy: 1000, max_energy: 1000, level: 1, multiplier: 1 }});
        }
    } catch (e) { 
        res.status(500).send(e.message); 
    }
});

app.post('/api/save', async (req, res) => {
    try {
        if (!db) return res.status(503).send("Database not ready");
        const d = req.body;
        if (!d.user_id || d.user_id === "guest") return res.json({status: "ignored"});

        const now = Math.floor(Date.now() / 1000);
        await db.run(`UPDATE users SET balance=?, click_lvl=?, pnl=?, energy=?, level=?, last_active=? WHERE id=?`,
            [
                parseFloat(d.score), 
                parseInt(d.tap_power), 
                parseFloat(d.pnl), 
                parseFloat(d.energy), 
                parseInt(d.level), 
                now, 
                String(d.user_id)
            ]
        );
        res.json({status: "ok"});
    } catch (e) { 
        res.status(500).send(e.message); 
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// --- [SOCKETS] ---
io.on('connection', (socket) => {
    socket.on('tap', (data) => {
        socket.emit('tap_ack', { ok: true });
    });
});

// --- [ЗАПУСК СЕРВЕРА] ---
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await initDB();
        
        // Удаляем вебхуки, чтобы работал Long Polling (важно для Bothost)
        await bot.telegram.deleteWebhook();
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Neural Pulse running on port ${PORT}`);
        });

        bot.launch();
        console.log("🤖 Telegram Bot Started");

    } catch (err) {
        console.error("CRITICAL ERROR DURING START:", err);
    }
}

startServer();

// Плавная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
