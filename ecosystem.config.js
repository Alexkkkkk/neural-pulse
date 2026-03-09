module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, 
    autorestart: true,
    watch: false,
    
    // Лимит памяти: PM2 перезапустит бота, если он превысит 450МБ
    max_memory_restart: '450M', 
    
    // Плавный перезапуск при критических ошибках (Backoff стратегия)
    exp_backoff_restart_delay: 1000, 
    min_uptime: "15s",
    
    // Даем 10 секунд на корректное закрытие SQLite (завершение транзакций)
    kill_timeout: 10000, 
    wait_ready: false, 

    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // Исправлено: Используем абсолютные пути для контейнера
    error_file: "/app/logs/error.log",
    out_file: "/app/logs/combined.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    
    // Ограничение кучи Node.js (V8)
    // Оставляем 50-100МБ запаса от общего лимита контейнера
    node_args: "--max-old-space-size=380 --no-warnings"
  }]
}
