import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- КОНФИГУРАЦИЯ ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const DOMAIN = "https://np.bothost.tech";
const PORT = 3000; 

const children = new Map();
let isBotStarted = false;

/**
 * Запуск дочернего процесса
 */
const launch = (file, env = {}) => {
    const child = fork(path.join(__dirname, file), {
        stdio: 'inherit',
        env: { ...process.env, ...env, BOT_TOKEN, DOMAIN }
    });
    children.set(file, child);
    return child;
};

/**
 * Инициализация Ядра
 */
const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE: ПОДГОТОВКА СРЕДЫ...');
    logger.system('══════════════════════════════════════════════════');

    try {
        // 1. Инициализация базы данных
        await initDB();
        logger.info("CORE_DB: ПОДКЛЮЧЕНО");

        // 2. Запуск только Админки (Внутренний порт 3001)
        const admin = launch('admin.js', { PORT: 3001 });

        admin.on('message', (msg) => {
            // Ждем сигнала готовности от AdminJS
            if (msg === 'ready' && !isBotStarted) {
                isBotStarted = true;
                
                logger.system("⏳ ADMIN_INTERNAL: OK. ОЖИДАНИЕ СБОРКИ БАНДЛА (20 сек)...");

                // 3. ПАУЗА 20 СЕКУНД
                // Это время нужно Node.js, чтобы завершить компиляцию JSX в папке .adminjs
                setTimeout(() => {
                    logger.system("✅ СБОРКА ЗАВЕРШЕНА. ЗАПУСК МАГИСТРАЛЬНОГО ШЛЮЗА...");
                    
                    // 4. Запуск Шлюза (Основной порт 3000 для Bothost)
                    launch('bot.js', { PORT: PORT });

                    // 5. Установка Webhook Telegram (через 10 секунд после запуска шлюза)
                    setTimeout(async () => {
                        try {
                            const url = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
                            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${url}&drop_pending_updates=true`);
                            const data = await res.json();
                            if (data.ok) {
                                logger.system("📡 TELEGRAM_WEBHOOK: ПОЛНАЯ ГОТОВНОСТЬ");
                            } else {
                                logger.error(`Ошибка Webhook: ${data.description}`);
                            }
                        } catch (e) { 
                            logger.error(`Сбой активации Webhook: ${e.message}`); 
                        }
                    }, 10000);

                }, 20000); // 20 секунд задержки
            }
        });

        // Обработка критического падения админки
        admin.on('exit', (code) => {
            logger.error(`[!] КРИТИЧЕСКИЙ СБОЙ: AdminJS вышел с кодом ${code}`);
            logger.system("Перезапуск системы через 5 секунд...");
            setTimeout(() => process.exit(1), 5000);
        });

    } catch (err) {
        logger.error("КРИТИЧЕСКИЙ СБОЙ ЯДРА ПРИ СТАРТЕ", err);
        process.exit(1);
    }
};

// Запуск двигателя
startEngine();
