module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    
    // Используем режим fork для стабильности на малых ресурсах.
    // JSON-база не боится нескольких инстансов так, как SQLite,
    // но на тарифе Pro 1 мощный поток лучше, чем 2 слабых.
    instances: 1,
    exec_mode: "fork",
    
    // Автоматический перезапуск
    autorestart: true,
    watch: false, // В продакшене лучше держать выключенным
    
    // Лимиты памяти: Bothost дает Pro-юзерам больше ресурсов, 
    // но 400M — это золотая середина для Node.js.
    max_memory_restart: '400M', 
    
    // Стратегия перезапуска при сбоях (экспоненциальный рост ожидания)
    // Предотвращает "спам" запросами к API Telegram при ошибках сети
    exp_backoff_restart_delay: 2000, 
    min_uptime: "15s",
    
    // Корректное завершение: даем серверу время сохранить JSON базу в файл
    // Мы увеличили время до 5 секунд, чтобы fs.writeFileSync успел отработать
    kill_timeout: 5000, 
    shutdown_with_message: true,
    
    // Ждать сигнала готовности от server.js (через process.send('ready'))
    // Это гарантирует, что PM2 не пометит бота как "Online", пока не загружена БД
    wait_ready: true, 
    listen_timeout: 3000,

    // Переменные окружения
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },

    // Логирование:
    // Bothost считывает stdout/stderr. Мы сохраняем логи и в файлы для отладки
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    error_file: "logs/err.log",
    out_file: "logs/out.log",

    // Оптимизация V8 (движка Node.js)
    node_args: [
      "--no-warnings",
      "--enable-source-maps",
      "--max-old-space-size=350" // Оставляем запас 50МБ для самой системы Node.js
    ]
  }]
}
