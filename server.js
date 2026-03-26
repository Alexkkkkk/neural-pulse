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

let isBotStarted = false;

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

const startBotOnce = () => {
    if (isBotStarted) return;
    isBotStarted = true;
    logger.system("🚀 Starting Bot Gateway on Port 3000...");
    launchProcess('bot.js', { PORT: PORT });

    const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`; 
    setTimeout(async () => {
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
            const result = await response.json();
            if (result.ok) logger.system("📡 TELEGRAM WEBHOOK: ACTIVE");
        } catch (e) { logger.error("Webhook Linkage Error"); }
    }, 10000);
};

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE ENGINE: BOOTSTRAP STARTING...');
    logger.system('══════════════════════════════════════════════════');

    try {
        const dbReady = await initDB();
        if (!dbReady) throw new Error("Database initialization failed.");
        logger.info("Database Engine: READY");

        startBotOnce();

        logger.info("Initializing AdminJS (3001)... Bundling started.");
        const adminChild = launchProcess('admin.js', { PORT: 3001 });

        adminChild.on('message', (msg) => {
            if (msg === 'ready') logger.system("✅ AdminJS is ONLINE.");
        });
    } catch (err) { 
        logger.error("CRITICAL ENGINE FAILURE", err); 
        process.exit(1);
    }
};

startEngine();
