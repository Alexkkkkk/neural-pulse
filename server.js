import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, sessionStore } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Твои данные из конфига
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";

// Функция для запуска дочерних процессов с авто-рестартом
const launchProcess = (fileName) => {
    const processPath = path.join(__dirname, fileName);
    const child = fork(processPath);

    child.on('exit', (code) => {
        logger.error(`${fileName} crashed with code ${code}. Restarting in 5s...`);
        setTimeout(() => launchProcess(fileName), 5000);
    });

    return child;
};

const startEngine = async () => {
    logger.system('--- NEURAL PULSE ENGINE BOOTSTRAP ---');

    try {
        // 1. Подключение к БД
        logger.progress(2, 10);
        await sequelize.authenticate();
        logger.info("Database connection: ESTABLISHED");

        // 2. Синхронизация таблиц и сессий
        logger.progress(4, 10);
        await sessionStore.sync();
        await sequelize.sync({ alter: true });
        logger.info("Database synchronization: COMPLETED");

        // 3. Запуск Бот-ядра и Админ-панели
        logger.progress(6, 10);
        logger.info("Starting Dual-Core Processes...");
        
        const botProcess = launchProcess('bot.js');
        const adminProcess = launchProcess('admin.js');

        // 4. Установка Webhook через официальный API Telegram
        logger.progress(8, 10);
        const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            const result = await response.json();
            if (result.ok) {
                logger.info("Telegram Webhook: LINKED SUCCESSFULLY");
            } else {
                logger.warn(`Telegram Webhook: ${result.description}`);
            }
        } catch (e) {
            logger.warn("Failed to link webhook: Network or API error");
        }

        // 5. Финальный статус
        logger.progress(10, 10);
        logger.system(`ENGINE STATUS: DUAL-CORE ONLINE`);
        logger.info(`Main App: ${DOMAIN}`);
        logger.info(`Admin Panel: ${DOMAIN}/admin (Port 3001)`);

    } catch (err) { 
        logger.error("CRITICAL ENGINE FAILURE", err); 
        process.exit(1);
    }
};

// Обработка мягкого выключения
const shutdown = async () => {
    logger.warn("System shutdown signal received. Closing resources...");
    try {
        await sequelize.close();
        logger.info("Database connections closed.");
    } catch (e) {
        logger.error("Error during database shutdown", e);
    }
    process.exit(0); 
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Поехали!
startEngine();
