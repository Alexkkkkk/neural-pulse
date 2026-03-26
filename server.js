import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFYxazvS95oEMuPeVxlWvnwmTsDOEiKZEI";
const DOMAIN = "https://np.bothost.tech";
const PORT = 3000; 

let isBotStarted = false;
const children = new Map();

const launchProcess = (fileName, customEnv = {}) => {
    const processPath = path.join(__dirname, fileName);
    
    if (children.has(fileName)) {
        children.get(fileName).kill();
    }

    const child = fork(processPath, { 
        stdio: 'inherit',
        env: { 
            ...process.env, 
            ...customEnv, 
            NODE_ENV: 'production',
            DOMAIN: DOMAIN,
            BOT_TOKEN: BOT_TOKEN
        } 
    });

    children.set(fileName, child);

    child.on('exit', (code) => {
        children.delete(fileName);
        if (code !== 0 && code !== null) {
            logger.error(`[CRASH] Модуль ${fileName} деактивирован (код ${code}). Регенерация через 7с...`);
            setTimeout(() => launchProcess(fileName, customEnv), 7000);
        }
    });

    return child;
};

// Функция активации бота (вызывается только по сигналу от админки)
const activateBotGateway = () => {
    if (isBotStarted) return;
    isBotStarted = true;
    
    logger.system("🚀 СИГНАЛ ПОЛУЧЕН: Запуск Магистрального Шлюза (Port 3000)...");
    launchProcess('bot.js', { PORT: PORT });

    const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`; 
    // Небольшая пауза, чтобы bot.js успел поднять express-сервер
    setTimeout(async () => {
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
            const result = await response.json();
            if (result.ok) {
                logger.system("📡 TELEGRAM WEBHOOK: КАНАЛ УСТАНОВЛЕН");
            } else {
                logger.error(`Webhook Fail: ${result.description}`);
            }
        } catch (e) { 
            logger.error("Ошибка линковки Webhook (Network Error)"); 
        }
    }, 5000);
};

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE ENGINE: ГОРЯЧИЙ ЗАПУСК СИСТЕМЫ');
    logger.system('══════════════════════════════════════════════════');

    try {
        const dbReady = await initDB();
        if (!dbReady) throw new Error("Database initialization failed.");
        logger.info("Ядро Базы Данных: СТАБИЛЬНО");

        // 1. Сначала запускаем только админку
        logger.info("Инициализация AdminJS (3001)... Подготовка бандла.");
        const adminChild = launchProcess('admin.js', { PORT: 3001 });

        // 2. Слушаем сообщение от админки
        adminChild.on('message', (msg) => {
            if (msg === 'ready') {
                logger.system("✅ АДМИН-ПАНЕЛЬ: ДОСТУП ОТКРЫТ");
                // 3. Только теперь запускаем бота
                activateBotGateway();
            }
        });

    } catch (err) { 
        logger.error("КРИТИЧЕСКИЙ СБОЙ ЯДРА", err); 
        process.exit(1);
    }
};

const handleShutdown = () => {
    logger.system("🛑 ОСТАНОВКА СИСТЕМЫ: ЗАВЕРШЕНИЕ ПРОЦЕССОВ...");
    for (const [name, child] of children) {
        child.kill('SIGTERM');
    }
    process.exit(0);
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

startEngine();
