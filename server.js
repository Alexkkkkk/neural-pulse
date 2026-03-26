import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";

logger.system('--- ENGINE BOOT SEQUENCE STARTED ---');

const launchProcess = (fileName, customEnv = {}) => {
    logger.info(`[MASTER] Попытка запуска модуля: ${fileName}...`);
    const processPath = path.join(__dirname, fileName);
    
    const child = fork(processPath, { 
        stdio: 'inherit',
        env: { ...process.env, ...customEnv, NODE_ENV: 'production' } 
    });

    child.on('spawn', () => logger.system(`[PROCESS] ${fileName} успешно порожден (PID: ${child.pid})`));

    child.on('exit', (code, signal) => {
        logger.error(`[CRASH] Модуль ${fileName} завершился! Код: ${code}, Сигнал: ${signal}`);
        logger.info(`[RESTART] Перезапуск ${fileName} через 7 секунд...`);
        setTimeout(() => launchProcess(fileName, customEnv), 7000);
    });

    child.on('error', (err) => logger.error(`[PROCESS_ERR] Ошибка в ${fileName}: ${err.message}`));

    return child;
};

const startEngine = async () => {
    try {
        logger.info("[DB_STEP] Подключение к базе данных...");
        const dbReady = await initDB();
        
        if (!dbReady) {
            logger.error("[DB_STEP] База данных не ответила. Двигатель остановлен.");
            process.exit(1);
        }
        logger.system("[DB_STEP] База данных: СИНХРОНИЗИРОВАНА");

        // 1. Бот запускается ПЕРВЫМ
        logger.info("[LAUNCH] Запуск Bot Gateway (Порт 3000)...");
        launchProcess('bot.js', { PORT: 3000 });

        // 2. Вебхук
        setTimeout(async () => {
            logger.info("[WEBHOOK] Регистрация URL в Telegram API...");
            try {
                const url = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
                const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${url}&drop_pending_updates=true`);
                const data = await res.json();
                logger.system(`[WEBHOOK] Ответ Telegram: ${JSON.stringify(data)}`);
            } catch (e) {
                logger.error(`[WEBHOOK] Ошибка связи с API Telegram: ${e.message}`);
            }
        }, 5000);

        // 3. Админка запускается ПОСЛЕДНЕЙ (через 8 сек)
        setTimeout(() => {
            logger.info("[LAUNCH] Запуск AdminJS (Порт 3001)...");
            launchProcess('admin.js', { PORT: 3001 });
        }, 8000);

    } catch (err) { 
        logger.error(`[FATAL] Ошибка запуска двигателя: ${err.stack}`); 
        process.exit(1);
    }
};

startEngine();
