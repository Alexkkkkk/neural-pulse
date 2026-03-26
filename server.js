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
const PORT = 3000; 

const launchProcess = (fileName, customEnv = {}) => {
    const processPath = path.join(__dirname, fileName);
    
    const child = fork(processPath, { 
        stdio: 'inherit',
        env: { ...process.env, ...customEnv, NODE_ENV: 'production' } 
    });

    child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            logger.error(`[CRASH] Модуль ${fileName} упал (код ${code}). Рестарт через 5с...`);
            setTimeout(() => launchProcess(fileName, customEnv), 5000);
        }
    });

    child.on('error', (err) => {
        logger.error(`[ERROR] Ошибка запуска модуля ${fileName}:`, err);
    });

    return child;
};

const startEngine = async () => {
    logger.system('--- NEURAL PULSE ENGINE BOOTSTRAP ---');

    try {
        logger.progress(2, 10);
        const dbReady = await initDB();
        if (!dbReady) throw new Error("Database initialization failed.");
        logger.info("Database Engine: READY & SYNCED");

        logger.progress(6, 10);
        
        // 1. ЗАПУСК АДМИНКИ на внутреннем порту 3001
        launchProcess('admin.js', { PORT: 3001 }); 
        
        // 2. ЗАПУСК БОТА (GATEWAY) на основном порту 3000
        setTimeout(() => {
            launchProcess('bot.js', { PORT: PORT });
        }, 2000);

        logger.progress(8, 10);
        
        // 3. ПРИВЯЗКА ВЕБХУКА
        // КРИТИЧНО: Убираем /admin, чтобы путь был https://np.bothost.tech/telegraf/...
        const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`; 
        
        setTimeout(async () => {
            try {
                logger.info(`Setting Webhook to: ${webhookUrl}`);
                const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
                const result = await response.json();
                
                if (result.ok) {
                    logger.info("Telegram Webhook: LINKED SUCCESSFULLY");
                } else {
                    logger.warn(`Telegram Webhook Warning: ${result.description}`);
                }
            } catch (e) {
                logger.warn("Webhook Linkage: Network error");
            }
        }, 5000);

        logger.progress(10, 10);
        logger.system(`ENGINE STATUS: ONLINE`);

    } catch (err) { 
        logger.error("CRITICAL ENGINE FAILURE", err); 
        process.exit(1);
    }
};

// Сигналы завершения
const shutdown = async () => {
    logger.warn("Stopping Engine...");
    try { await sequelize.close(); } catch (e) {}
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startEngine();
