const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'game.db');

// Настройка базы данных
async function initDB() {
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            balance REAL DEFAULT 1000,
            level INTEGER DEFAULT 1,
            energy REAL DEFAULT 1000,
            max_energy INTEGER DEFAULT 1000,
            last_active INTEGER
        )
    `);
    return db;
}

// Раздача статики
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// API Эндпоинты
app.get('/api/user/:id', async (req, res) => {
    const db = await initDB();
    let user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    
    if (!user) {
        const now = Math.floor(Date.now() / 1000);
        await db.run('INSERT INTO users (id, last_active) VALUES (?, ?)', [req.params.id, now]);
        user = { id: req.params.id, balance: 1000, level: 1, energy: 1000 };
    }
    res.json(user);
});

// WebSockets для кликов (High-load ready)
io.on('connection', (socket) => {
    socket.on('tap', async (data) => {
        // В будущем здесь будет батчинг (накопление кликов в Redis)
        // Сейчас просто подтверждаем получение
        socket.emit('tap_ack', { status: 'ok', score: 1 });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Node.js Quantum Server running on port ${PORT}`);
});
