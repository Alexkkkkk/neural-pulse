const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'game.db');

// Инициализация базы данных SQLite
async function initDB() {
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            balance REAL DEFAULT 1000,
            level INTEGER DEFAULT 1,
            energy REAL DEFAULT 1000,
            max_energy INTEGER DEFAULT 1000,
            pnl REAL DEFAULT 0,
            last_active INTEGER
        )
    `);
    return db;
}

// Раздача статики (дизайн, картинки, скрипты)
app.use('/static', express.static(path.join(__dirname, 'static')));

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// API получения данных игрока
app.get('/api/user/:id', async (req, res) => {
    try {
        const db = await initDB();
        let user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
        
        if (!user) {
            const now = Math.floor(Date.now() / 1000);
            await db.run('INSERT INTO users (id, last_active) VALUES (?, ?)', [req.params.id, now]);
            user = { id: req.params.id, balance: 1000, level: 1, energy: 1000, max_energy: 1000, pnl: 0 };
        }
        res.json({ status: 'ok', data: user });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Обработка кликов через WebSockets (для скорости)
io.on('connection', (socket) => {
    socket.on('tap', (data) => {
        // Здесь будет логика валидации тапа (защита от читов)
        socket.emit('tap_ack', { status: 'ok', added: 1 });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Quantum Node Server started on port ${PORT}`);
});
