module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, 
    autorestart: true,
    watch: false,
    
    // Лимит памяти: PM2 перезапустит процесс, если он превысит 450МБ.
    // Это отличная страховка для тарифа Pro.
    max_memory_restart: '450M', 
    
    // Плавный перезапуск при сбоях (экспоненциальная задержка).
    // Позволяет избежать бесконечного цикла быстрых перезагрузок.
    exp_backoff_restart_delay: 1000, 
    min_uptime: "15s",
    
    // ВАЖНО: Время на сохранение данных при выключении (в мс).
    // Твой flushToDisk работает каждые 30 сек. 10 секунд на экстренное сохранение —
    // это золотой стандарт для SQLite в Docker.
    kill_timeout: 10000, 
    
    // Отключаем ожидание сигнала "ready", так как server.js запускается сразу.
    wait_ready: false, 

    // Настройки окружения
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // ЛОГИРОВАНИЕ:
    // Мы используем относительные пути. Убедись, что в Dockerfile есть RUN mkdir -p logs
    error_file: "./logs/error.log",
    out_file: "./logs/combined.log",
    
    // Формат даты для логов в консоли Bothost
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    
    // Аргументы Node.js:
    // --max-old-space-size: ограничиваем кучу, чтобы процесс не убил Docker-демон по OOM.
    // Оставляем запас в 50МБ до лимита PM2 (400 heap + системные нужды = ~450 total).
    node_args: "--max-old-space-size=400 --no-warnings"
  }]
}
