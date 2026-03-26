import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";
const PORT = 3000; 

let isBotStarted = false;
const children = new Map(); // Хранилище ссылок на активные процессы

// Универсальный менеджер процессов с авто-регенерацией
const launchProcess = (fileName, customEnv = {}) => {
    const processPath = path.join(__dirname, fileName);
    
    // Если процесс уже запущен, не дублируем (защита от утечек)
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

const startBotOnce = () => {
    if (isBotStarted) return;
    isBotStarted = true;
    
    logger.system("🚀 Запуск Магистрального Шлюза (Port 3000)...");
    launchProcess('bot.js', { PORT: PORT });

    // Установка Вебхука с задержкой 15с (даем время на запуск Express)
    const webhookUrl = `${DOMAIN}/telegraf/${BOT_TOKEN}`; 
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
    }, 15000);
};

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE ENGINE: ГОРЯЧИЙ ЗАПУСК СИСТЕМЫ');
    logger.system('══════════════════════════════════════════════════');

    try {
        // 1. Инициализация БД
        const dbReady = await initDB();
        if (!dbReady) throw new Error("Database initialization failed.");
        logger.info("Ядро Базы Данных: СТАБИЛЬНО");

        // 2. Запуск основного шлюза (Бот + API)
        startBotOnce();

        // 3. Запуск админки на порту 3001
        logger.info("Инициализация AdminJS (3001)... Подготовка бандла.");
        const adminChild = launchProcess('admin.js', { PORT: 3001 });

        // Слушаем сигнал "ready" от процесса админки
        adminChild.on('message', (msg) => {
            if (msg === 'ready') {
                logger.system("✅ АДМИН-ПАНЕЛЬ: ДОСТУП ОТКРЫТ");
            }
        });

    } catch (err) { 
        logger.error("КРИТИЧЕСКИЙ СБОЙ ЯДРА", err); 
        process.exit(1);
    }
};

// --- ГРАЦИОЗНОЕ ЗАВЕРШЕНИЕ ---
// Важно для Bothost, чтобы не оставалось "висящих" процессов
const handleShutdown = () => {
    logger.system("🛑 ОСТАНОВКА СИСТЕМЫ: ЗАВЕРШЕНИЕ ПРОЦЕССОВ...");
    for (const [name, child] of children) {
        logger.info(`Убийство процесса: ${name}`);
        child.kill('SIGTERM');
    }
    process.exit(0);
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Запуск двигателя
startEngine();
