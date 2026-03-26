import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
            logger.error(`[CRASH] Модуль ${fileName} упал (код ${code}). Рестарт через 7с...`);
            setTimeout(() => launchProcess(fileName, customEnv), 7000);
        }
    });

    return child;
};

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE ENGINE: BOOTSTRAP STARTING...');
    logger.system('══════════════════════════════════════════════════');

    try {
        const dbReady = await initDB();
        if (!dbReady) throw new Error("Database initialization failed.");
        logger.info("Database Engine: READY");

        // 1. ЗАПУСК АДМИНКИ
        logger.info("Initializing AdminJS (3001)... Please wait for bundling.");
        const adminChild = launchProcess('admin.js', { PORT: 3001 });

        // Ждем сообщения 'ready' от admin.js
        adminChild.on('message', (msg) => {
            if (msg === 'ready') {
                logger.system("✅ AdminJS is ONLINE. Starting Gateway...");
                
                // 2. ЗАПУСК БОТА только после готовности админки
                launchProcess('bot.js', { PORT: PORT });

                // 3. ПРИВЯЗКА ВЕБХУКА
                const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`; 
                setTimeout(async () => {
                    try {
                        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
                        const result = await response.json();
                        if (result.ok) logger.system("📡 TELEGRAM WEBHOOK: ACTIVE");
                    } catch (e) {
                        logger.error("Webhook Linkage Error");
                    }
                }, 5000);
            }
        });

        // ПРЕДОХРАНИТЕЛЬ: Если админка не ответила за 60 сек, запускаем бота принудительно
        setTimeout(() => {
            if (adminChild.connected) {
                logger.warn("AdminJS taking too long. Forcing Gateway start...");
                launchProcess('bot.js', { PORT: PORT });
            }
        }, 60000);

    } catch (err) { 
        logger.error("CRITICAL ENGINE FAILURE", err); 
        process.exit(1);
    }
};

const shutdown = async () => {
    logger.warn("Stopping Engine Processes...");
    try { await sequelize.close(); } catch (e) {}
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startEngine();
