const express = require('express');
const http = require('http');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
// Раздаем статику: картинки должны быть в static/images/
app.use('/static', express.static(path.join(__dirname, 'static')));

// --- [ИНИЦИАЛИЗАЦИЯ БД] ---
let db;
(async () => {
    db = await open({
        filename: path.join(__dirname, 'game.db'),
        driver: sqlite3.Database
    });
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
        pnl REAL DEFAULT 0, energy REAL, max_energy INTEGER, 
        level INTEGER DEFAULT 1, last_active INTEGER)`);
    console.log("💾 Database & Tables Ready");
})();

// --- [API ЭНДПОИНТЫ] ---
app.get('/api/balance/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const now = Math.floor(Date.now() / 1000);
        let user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (user) {
            const offTime = Math.min(now - (user.last_active || now), 10800);
            const earned = (user.pnl / 3600) * offTime;
            res.json({ status: "ok", data: {
                score: user.balance + earned, tap_power: user.click_lvl,
                pnl: user.pnl, energy: user.energy, level: user.level,
                max_energy: user.max_energy, multiplier: 1
            }});
        } else {
            // Новый пользователь
            await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                          VALUES (?, 1000, 1, 0, 1000, 1000, 1, ?)`, [userId, now]);
            res.json({ status: "ok", data: { score: 1000, tap_power: 1, pnl: 0, energy: 1000, max_energy: 1000, level: 1, multiplier: 1 }});
        }
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/save', async (req, res) => {
    try {
        const d = req.body;
        if (!d.user_id || d.user_id === "guest") return res.json({status: "ignored"});
        const now = Math.floor(Date.now() / 1000);
        await db.run(`UPDATE users SET balance=?, click_lvl=?, pnl=?, energy=?, level=?, last_active=? WHERE id=?`,
            [d.score, d.tap_power, d.pnl, d.energy, d.level, now, d.user_id]);
        res.json({status: "ok"});
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'static', 'index.html')));

// --- [SOCKETS ДЛЯ ТАПОВ] ---
io.on('connection', (socket) => {
    socket.on('tap', () => socket.emit('tap_ack', { ok: true }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Neural Pulse running on port ${PORT}`));
