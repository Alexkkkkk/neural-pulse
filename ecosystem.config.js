module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, 
    autorestart: true,
    watch: false,
    
    // Лимиты памяти для стабильности на Pro тарифе
    max_memory_restart: '450M', 
    
    // Плавный перезапуск при сбоях
    exp_backoff_restart_delay: 1000, 
    min_uptime: "15s",
    
    // Даем 10 секунд на завершение операций с БД при выключении
    kill_timeout: 10000, 
    wait_ready: false, 

    // Переменные окружения
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // Пути к логам (папка logs создается в Dockerfile)
    error_file: "./logs/error.log",
    out_file: "./logs/combined.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    
    // Ограничение кучи Node.js (V8)
    node_args: "--max-old-space-size=400 --no-warnings"
  }]
}
