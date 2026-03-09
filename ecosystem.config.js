module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, 
    autorestart: true,
    watch: false,
    
    // Лимит памяти: PM2 перезапустит бота, если он превысит 450МБ
    max_memory_restart: '450M', 
    
    // Плавный перезапуск при критических ошибках
    exp_backoff_restart_delay: 1000, 
    min_uptime: "15s",
    
    // Даем 10 секунд на корректное закрытие SQLite перед выключением
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
    
    // Настройка логов для панели Bothost (папка /logs создана в Dockerfile)
    error_file: "./logs/error.log",
    out_file: "./logs/combined.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    
    // Ограничение кучи Node.js (V8) для стабильности в контейнере
    node_args: "--max-old-space-size=400 --no-warnings"
  }]
}
