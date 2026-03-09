module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, 
    autorestart: true,
    watch: false,
    
    // Лимит памяти: PM2 перезапустит бота, если он превысит 450МБ
    max_memory_restart: '450M', 
    
    // Стратегия задержки перезапуска (защита от цикличных падений)
    exp_backoff_restart_delay: 1000, 
    min_uptime: "15s",
    
    // Даем 10 секунд на корректное закрытие SQLite перед принудительным убийством процесса
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
    
    // Использование абсолютных путей гарантирует запись логов в Docker
    error_file: "/app/logs/error.log",
    out_file: "/app/logs/combined.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    time: true, // Добавляет время к каждому выводу console.log в общий файл
    
    // Настройки V8: ограничение кучи памяти (Heap) чуть ниже лимита перезапуска PM2
    // Это позволяет PM2 мягко перезагрузить бота до того, как его убьет система (OOM)
    node_args: "--max-old-space-size=380 --no-warnings"
  }]
}
