import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; 
import { sequelize, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Данные конфигурации
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";

/**
 * Функция для запуска дочерних процессов (Bot и Admin)
 * с автоматическим рестартом при падении.
 */
const launchProcess = (fileName) => {
    const processPath = path.join(__dirname, fileName);
    const child = fork(processPath);

    child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            logger.error(`${fileName} crashed with code ${code}. Restarting in 5s...`);
            setTimeout(() => launchProcess(fileName), 5000);
        }
    });

    return child;
};

/**
 * Главная функция запуска движка
 */
const startEngine = async () => {
    logger.system('--- NEURAL PULSE ENGINE BOOTSTRAP ---');

    try {
        // 1. Инициализация базы данных
        // Мы используем initDB(), которая делает authenticate и sync({ force: true })
        logger.progress(2, 10);
        const dbReady = await initDB();
        
        if (!dbReady) {
            throw new Error("Database initialization failed. Check your PG_URI.");
        }
        logger.info("Database Engine: READY & SYNCED");

        // 2. Запуск Бот-ядра и Админ-панели
        // Запускаем их ТОЛЬКО после того, как БД готова
        logger.progress(6, 10);
        logger.info("Starting Dual-Core Processes...");
        
        launchProcess('bot.js');
        launchProcess('admin.js');

        // 3. Установка Webhook через API Telegram
        logger.progress(8, 10);
        const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            const result = await response.json();
            if (result.ok) {
                logger.info("Telegram Webhook: LINKED SUCCESSFULLY");
            } else {
                logger.warn(`Telegram Webhook Warning: ${result.description}`);
            }
        } catch (e) {
            logger.warn("Failed to link webhook: Network or API error");
        }

        // 4. Финальный статус
        logger.progress(10, 10);
        logger.system(`ENGINE STATUS: DUAL-CORE ONLINE`);
        logger.info(`Main App URL: ${DOMAIN}`);
        logger.info(`Admin Access: ${DOMAIN}/admin`);

    } catch (err) { 
        logger.error("CRITICAL ENGINE FAILURE", err); 
        process.exit(1);
    }
};

/**
 * Обработка корректного завершения работы (SIGTERM/SIGINT)
 */
const shutdown = async () => {
    logger.warn("System shutdown signal received. Closing resources...");
    try {
        await sequelize.close();
        logger.info("Database connections closed safely.");
    } catch (e) {
        logger.error("Error during database shutdown", e);
    }
    process.exit(0); 
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Поехали!
startEngine();
