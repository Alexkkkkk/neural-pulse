const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const apiRoutes = require('./src/routes/api');

const app = express();
const server = http.createServer(app);

// Настройка Socket.io с поддержкой CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());

// Раздача статики
app.use('/static', express.static(path.join(__dirname, 'static')));

// Подключаем API
app.use('/api', apiRoutes);

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// Логика сокетов
io.on('connection', (socket) => {
    socket.on('tap', (data) => {
        // Просто подтверждаем получение, чтобы клиент не висел
        socket.emit('tap_ack', { status: 'ok' });
    });
});

// На Bothost переменная PORT может назначаться автоматически, 
// поэтому используем process.env.PORT || 3000
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Neural Pulse Server is running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Ошибка: Порт ${PORT} занят. Попробуйте перезапустить бота в панели Bothost.`);
    } else {
        console.error(err);
    }
});
