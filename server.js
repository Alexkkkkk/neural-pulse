import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- КОНФИГУРАЦИЯ ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";

/**
 * Функция безопасного запуска дочерних процессов с авто-рестартом
 */
const launchProcess = (fileName) => {
    const processPath = path.join(__dirname, fileName);
    
    // stdio: 'inherit' транслирует логи дочернего процесса в это окно
    const child = fork(processPath, { 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' } 
    });

    child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            logger.error(`[CRASH] Модуль ${fileName} упал (код ${code}). Рестарт через 5с...`);
            setTimeout(() => launchProcess(fileName), 5000);
        }
    });

    child.on('error', (err) => {
        logger.error(`[ERROR] Ошибка запуска модуля ${fileName}:`, err);
    });

    return child;
};

/**
 * Главный запуск двигателя Neural Pulse
 */
const startEngine = async () => {
    logger.system('--- NEURAL PULSE ENGINE BOOTSTRAP ---');

    try {
        logger.progress(2, 10);
        
        // 1. Инициализация БД
        const dbReady = await initDB();
        if (!dbReady) throw new Error("Database initialization failed.");
        logger.info("Database Engine: READY & SYNCED");

        logger.progress(6, 10);
        
        // 2. Запуск ядра (AdminJS и Bot)
        // ВАЖНО: Убедись, что в admin.js прописан порт 3001
        launchProcess('admin.js'); 
        launchProcess('bot.js');

        logger.progress(8, 10);
        
        // 3. Привязка вебхука Telegram
        const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
            const result = await response.json();
            
            if (result.ok) {
                logger.info("Telegram Webhook: LINKED SUCCESSFULLY");
            } else {
                logger.warn(`Telegram Webhook Warning: ${result.description}`);
            }
        } catch (e) {
            logger.warn("Webhook Linkage: Network error (Skip for local run)");
        }

        logger.progress(10, 10);
        logger.system(`ENGINE STATUS: ONLINE`);
        logger.info(`App URL: ${DOMAIN}`);
        logger.info(`Admin: ${DOMAIN}/admin`);

    } catch (err) { 
        logger.error("CRITICAL ENGINE FAILURE", err); 
        process.exit(1);
    }
};

// --- ОБРАБОТКА СИСТЕМНЫХ СОБЫТИЙ ---

// Ловим необработанные ошибки, чтобы Engine не "молчал"
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const shutdown = async () => {
    logger.warn("Сигнал остановки. Закрытие ресурсов...");
    try {
        await sequelize.close();
        logger.info("База данных успешно отключена.");
    } catch (e) {
        logger.error("Ошибка при закрытии базы данных:", e);
    }
    process.exit(0); 
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startEngine();
