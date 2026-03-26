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
    
    // Передаем текущие переменные окружения + кастомные
    const child = fork(processPath, { 
        stdio: 'inherit',
        env: { ...process.env, ...customEnv, NODE_ENV: 'production' } 
    });

    child.on('exit', (code) => {
        // Если процесс закрылся с ошибкой (не 0)
        if (code !== 0 && code !== null) {
            logger.error(`[CRASH] Модуль ${fileName} упал (код ${code}). Рестарт через 7с...`);
            setTimeout(() => launchProcess(fileName, customEnv), 7000);
        }
    });

    child.on('error', (err) => {
        logger.error(`[ERROR] Ошибка запуска модуля ${fileName}:`, err);
    });

    return child;
};

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE ENGINE: BOOTSTRAP STARTING...');
    logger.system('══════════════════════════════════════════════════');

    try {
        // 0. Инициализация БД (единая точка входа)
        const dbReady = await initDB();
        if (!dbReady) throw new Error("Database initialization failed.");
        logger.info("Database Engine: READY & SYNCED");

        // 1. ЗАПУСК АДМИНКИ (Порт 3001)
        // Запускаем первой, так как она долго "прогревается"
        logger.info("Starting AdminJS Module on port 3001...");
        launchProcess('admin.js', { PORT: 3001 }); 
        
        // 2. ЗАПУСК БОТА (Порт 3000 - основной вход Bothost)
        // Даем админке 3 секунды форы
        setTimeout(() => {
            logger.info("Starting Telegram Bot Gateway on port 3000...");
            launchProcess('bot.js', { PORT: PORT });
        }, 3000);

        // 3. ПРИВЯЗКА ВЕБХУКА (Через 8 секунд после старта)
        const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`; 
        
        setTimeout(async () => {
            try {
                logger.info(`Linking Webhook: ${webhookUrl}`);
                const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
                const result = await response.json();
                
                if (result.ok) {
                    logger.system("📡 TELEGRAM WEBHOOK: ACTIVE");
                } else {
                    logger.warn(`📡 TELEGRAM WEBHOOK: ${result.description}`);
                }
            } catch (e) {
                logger.error("Webhook Linkage Error: Network Timeout");
            }
        }, 8000);

        logger.system(`ENGINE STATUS: ONLINE (Master Process)`);

    } catch (err) { 
        logger.error("CRITICAL ENGINE FAILURE", err); 
        process.exit(1);
    }
};

// Сигналы завершения
const shutdown = async () => {
    logger.warn("Stopping Engine Processes...");
    try { await sequelize.close(); } catch (e) {}
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startEngine();
