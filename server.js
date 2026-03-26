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
const PORT = 3000; // Оба процесса должны знать основной порт хостинга

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
        
        // ЗАПУСК АДМИНКИ (на порту 3000)
        launchProcess('admin.js', { PORT: PORT }); 
        
        // ЗАПУСК БОТА (с небольшой задержкой)
        setTimeout(() => {
            launchProcess('bot.js', { PORT: PORT });
        }, 2000);

        logger.progress(8, 10);
        
        // ПРИВЯЗКА ВЕБХУКА
        // Если бот работает через Telegraf Webhook внутри AdminJS, 
        // путь должен совпадать с тем, что в admin.js
        const webhookUrl = `${DOMAIN}/admin/telegraf/${BOT_TOKEN}`; 
        
        setTimeout(async () => {
            try {
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

// ... (обработка SIGTERM/SIGINT остается без изменений)

startEngine();
