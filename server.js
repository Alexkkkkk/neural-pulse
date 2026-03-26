import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Константы проекта Neural Pulse
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";

const launchProcess = (fileName) => {
    const processPath = path.join(__dirname, fileName);
    
    // stdio: 'inherit' позволяет видеть консоль дочерних процессов в главном окне
    const child = fork(processPath, { stdio: 'inherit' });

    child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            logger.error(`[CRASH] ${fileName} завершился с кодом ${code}. Рестарт через 5с...`);
            setTimeout(() => launchProcess(fileName), 5000);
        }
    });

    child.on('error', (err) => {
        logger.error(`[ERROR] Не удалось запустить ${fileName}:`, err);
    });

    return child;
};

const startEngine = async () => {
    logger.system('--- NEURAL PULSE ENGINE BOOTSTRAP ---');

    try {
        logger.progress(2, 10);
        // Инициализация базы данных из db.js
        const dbReady = await initDB();
        
        if (!dbReady) throw new Error("Database initialization failed.");
        logger.info("Database Engine: READY & SYNCED");

        logger.progress(6, 10);
        logger.info("Starting Dual-Core Processes...");
        
        // Запуск бота и AdminJS как отдельных веток
        launchProcess('bot.js');
        launchProcess('admin.js');

        logger.progress(8, 10);
        const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
        
        try {
            // Установка вебхука с очисткой старых обновлений
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
            const result = await response.json();
            
            if (result.ok) {
                logger.info("Telegram Webhook: LINKED SUCCESSFULLY");
            } else {
                logger.warn(`Telegram Webhook Warning: ${result.description}`);
            }
        } catch (e) {
            logger.warn("Failed to link webhook: Network or API error");
        }

        logger.progress(10, 10);
        logger.system(`ENGINE STATUS: DUAL-CORE ONLINE`);
        logger.info(`Main App URL: ${DOMAIN}`);
        logger.info(`Admin Access: ${DOMAIN}/admin`);

    } catch (err) { 
        logger.error("CRITICAL ENGINE FAILURE", err); 
        process.exit(1);
    }
};

const shutdown = async () => {
    logger.warn("Получен сигнал остановки системы. Закрытие ресурсов...");
    try {
        await sequelize.close();
        logger.info("Соединения с базой данных закрыты.");
    } catch (e) {
        logger.error("Ошибка при закрытии базы данных", e);
    }
    process.exit(0); 
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startEngine();
