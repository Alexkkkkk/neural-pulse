const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Генерация динамической версии для отображения (Quantum Full)
const getDynamicVersion = () => {
    const build = Math.floor(Date.now() / 100000).toString().slice(-3);
    return `v3.8.8.${build} Quantum Full`;
};

app.use(express.static(path.join(__dirname, 'static')));

// API для получения версии клиентом
app.get('/api/config', (req, res) => {
    res.json({ version: getDynamicVersion() });
});

app.listen(PORT, () => {
    console.log(`\n====================================`);
    console.log(`[BOOT HOST] SYSTEM STARTING...`);
    console.log(`[VERSION] ${getDynamicVersion()}`);
    console.log(`[STATUS] ACCESS GRANTED`);
    console.log(`====================================\n`);
});
