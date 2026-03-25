import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`\n` + `═`.repeat(50));
console.log(`[${new Date().toLocaleString()}] 🚀 SYSTEM: NEURAL PULSE DUAL-CORE BOOTSTRAP`);
console.log(`═`.repeat(50) + `\n`);

const startSystems = async () => {
    try {
        console.log('⚙️ LOADING: Synchronizing Database...');
        await sequelize.authenticate();
        await sequelize.sync({ alter: true }); // Создаст таблицы, если их нет
        console.log('🟢 INFO: Database synchronized.');

        // Запуск бота
        const botProcess = fork(path.join(__dirname, 'bot.js'));
        botProcess.on('exit', (code) => console.log(`🔴 BOT CRASHED with code ${code}`));

        // Запуск админки
        const adminProcess = fork(path.join(__dirname, 'admin.js'));
        adminProcess.on('exit', (code) => console.log(`🔴 ADMIN CRASHED with code ${code}`));

    } catch (err) {
        console.error('🔴 CRITICAL: Failed to start systems', err);
        process.exit(1);
    }
};

startSystems();
