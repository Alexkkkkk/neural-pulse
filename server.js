import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";

const launchProcess = (fileName, customEnv = {}) => {
    const processPath = path.join(__dirname, fileName);
    const child = fork(processPath, { 
        stdio: 'inherit',
        env: { ...process.env, ...customEnv, NODE_ENV: 'production' } 
    });

    child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            logger.error(`[CRASH] ${fileName} упал (код ${code}). Рестарт через 5с...`);
            setTimeout(() => launchProcess(fileName, customEnv), 5000);
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

        // 1. ЗАПУСКАЕМ БОТА ПЕРВЫМ (Порт 3000)
        logger.system("🚀 Starting Bot Gateway (Port 3000)...");
        launchProcess('bot.js', { PORT: 3000 });

        // 2. Устанавливаем Webhook для Telegram
        const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`; 
        setTimeout(async () => {
            try {
                const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
                const result = await response.json();
                if (result.ok) logger.system("📡 TELEGRAM WEBHOOK: ACTIVE");
            } catch (e) {
                logger.error("Webhook Linkage Error");
            }
        }, 3000);

        // 3. ЗАПУСКАЕМ АДМИНКУ ВТОРЫМ ЭТАПОМ (Порт 3001)
        // Ждем 5 секунд, чтобы бот успел занять порт и прогреть кэш
        setTimeout(() => {
            logger.info("Initializing AdminJS (3001)...");
            launchProcess('admin.js', { PORT: 3001 });
        }, 5000);

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
