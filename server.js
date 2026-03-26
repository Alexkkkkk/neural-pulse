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

const children = new Map();
let isBotStarted = false;

const launch = (file, env = {}) => {
    const child = fork(path.join(__dirname, file), {
        stdio: 'inherit',
        env: { ...process.env, ...env, BOT_TOKEN, DOMAIN }
    });
    children.set(file, child);
    return child;
};

const startEngine = async () => {
    logger.system('══════════════════════════════════════════════════');
    logger.system('🚀 NEURAL PULSE: СИНХРОНИЗАЦИЯ СИСТЕМЫ...');
    logger.system('══════════════════════════════════════════════════');

    try {
        await initDB();
        logger.info("CORE_DB: СТАБИЛЬНО");

        // Запуск Админки (Порт 3001)
        const admin = launch('admin.js', { PORT: 3001 });

        admin.on('message', (msg) => {
            if (msg === 'ready' && !isBotStarted) {
                isBotStarted = true;
                logger.system("✅ ADMIN_READY: ЗАПУСК МАГИСТРАЛЬНОГО ШЛЮЗА...");
                
                // Запуск Шлюза (Порт 3000)
                launch('bot.js', { PORT: PORT });

                // Установка Webhook через 10 секунд
                setTimeout(async () => {
                    try {
                        const url = `${DOMAIN}/telegraf/${BOT_TOKEN}`;
                        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${url}&drop_pending_updates=true`);
                        const data = await res.json();
                        if (data.ok) logger.system("📡 TELEGRAM_WEBHOOK: АКТИВИРОВАН");
                    } catch (e) { logger.error("Ошибка линковки Webhook"); }
                }, 10000);
            }
        });

        admin.on('exit', (code) => {
            logger.error(`Критический сбой админки (код ${code}). Рестарт системы...`);
            process.exit(1);
        });

    } catch (err) {
        logger.error("КРИТИЧЕСКИЙ СБОЙ ЯДРА", err);
        process.exit(1);
    }
};

startEngine();
