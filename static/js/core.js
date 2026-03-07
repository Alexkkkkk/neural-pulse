// Клиентский скрипт - выполняется только в браузере!
const tg = window.Telegram.WebApp;
tg.expand();

const socket = io(); // Подключение к нашему Node.js серверу

// Логика инициализации...
console.log("Neural Pulse Core Initialized");
