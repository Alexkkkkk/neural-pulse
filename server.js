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
    logger.info(`[MASTER] Попытка запуска: ${fileName}...`);
    const processPath = path.join(__dirname, fileName);
    
    const child = fork(processPath, { 
        stdio: 'inherit',
        env: { ...process.env, ...customEnv, NODE_ENV: 'production' } 
    });

    child.on('exit', (code) => {
        logger.error(`[CRASH] Модуль ${fileName} упал (код ${code}). Рестарт через 5с...`);
        setTimeout(() => launchProcess(fileName, customEnv), 5000);
    });
    return child;
};

const startEngine = async () => {
    logger.system('🚀 NEURAL PULSE ENGINE: STARTING...');
    try {
        const dbReady = await initDB();
        if (!dbReady) throw new Error("DB_FAILED");
        logger.info("[DB] База данных готова.");

        // ШАГ 1: Запуск бота (мгновенно)
        launchProcess('bot.js', { PORT: 3000 });

        // ШАГ 2: Установка вебхука (через 5 сек)
        setTimeout(async () => {
            const url = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
            try {
                const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${url}&drop_pending_updates=true`);
                const data = await res.json();
                logger.system(`[WEBHOOK] Статус: ${data.ok ? 'ACTIVE' : 'ERROR'}`);
            } catch (e) { logger.error("[WEBHOOK] Ошибка связи"); }
        }, 5000);

        // ШАГ 3: Запуск админки (через 10 сек, когда бот уже прогрелся)
        setTimeout(() => {
            logger.info("[LAUNCH] Запуск AdminJS...");
            launchProcess('admin.js', { PORT: 3001 });
        }, 10000);

    } catch (err) { 
        logger.error(`[FATAL] Ошибка запуска: ${err.message}`); 
        process.exit(1);
    }
};

startEngine();
