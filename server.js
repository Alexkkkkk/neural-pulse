import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, sessionStore } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";

const startEngine = async () => {
    logger.system('--- NEURAL PULSE ENGINE BOOTSTRAP ---');

    try {
        logger.progress(2, 10);
        await sequelize.authenticate();
        logger.info("Database connection: ESTABLISHED");

        logger.progress(4, 10);
        await sessionStore.sync();
        await sequelize.sync({ alter: true });
        logger.info("Database synchronization: COMPLETED");

        logger.progress(6, 10);
        const botProcess = fork(path.join(__dirname, 'bot.js'));
        const adminProcess = fork(path.join(__dirname, 'admin.js'));

        botProcess.on('exit', (code) => logger.error(`Bot crashed with code ${code}`));
        adminProcess.on('exit', (code) => logger.error(`Admin crashed with code ${code}`));

        logger.progress(8, 10);
        // Мы вызываем webhook тут разово через fetch, чтобы не импортировать Telegraf в диспетчер
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${DOMAIN}/telegraf/${BOT_TOKEN}`)
            .then(() => logger.info("Telegram Webhook: LINKED"))
            .catch(e => logger.warn("Failed to link webhook automatically"));

        logger.progress(10, 10);
        logger.system(`ENGINE STATUS: DUAL-CORE ONLINE`);

    } catch (err) { 
        logger.error("CRITICAL ENGINE FAILURE", err); 
        process.exit(1);
    }
};

const shutdown = async () => {
    logger.info("System shutdown signal received");
    await sequelize.close(); 
    process.exit(0); 
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startEngine();
