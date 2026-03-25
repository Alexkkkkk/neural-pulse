import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";

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

const startEngine = async () => {
    logger.system('--- NEURAL PULSE ENGINE BOOTSTRAP ---');

    try {
        logger.progress(2, 10);
        const dbReady = await initDB();
        
        if (!dbReady) throw new Error("Database initialization failed.");
        logger.info("Database Engine: READY & SYNCED");

        logger.progress(6, 10);
        logger.info("Starting Dual-Core Processes...");
        launchProcess('bot.js');
        launchProcess('admin.js');

        logger.progress(8, 10);
        const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
        
        try {
            // Используем встроенный в Node 18+ fetch
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

startEngine();
