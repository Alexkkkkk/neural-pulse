module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    
    // SQLite требует строго 1 инстанс в режиме fork (кластер сломает БД)
    instances: 1,
    exec_mode: "fork",
    
    // Перезапуск
    autorestart: true,
    watch: false,
    max_memory_restart: '400M', 
    
    // Задержки при сбоях (экспоненциальный рост ожидания)
    exp_backoff_restart_delay: 2000, 
    min_uptime: "15s",
    
    // Завершение работы: даем приложению время закрыть соединения с БД
    kill_timeout: 5000, 
    shutdown_with_message: true,
    wait_ready: true, // Ждать сигнала готовности (если используешь process.send('ready'))

    // Переменные окружения
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },

    // Логирование:
    // Мы убираем жесткую привязку к /dev/stdout, чтобы PM2 не дублировал логи
    // Bothost сам считывает консольный вывод процесса
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    error_file: "logs/err.log",
    out_file: "logs/out.log",

    // Аргументы Node.js
    node_args: [
      "--no-warnings",
      "--enable-source-maps",
      "--max-old-space-size=384" // Ограничиваем V8 внутри лимита 400M
    ],

    // Слушать сигналы от Docker (Tini)
    listen_timeout: 3000
  }]
}
