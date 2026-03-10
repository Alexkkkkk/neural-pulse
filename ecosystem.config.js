module.exports = {
  apps: [{
    name: "neural-pulse-core",
    // ВАЖНО: Меняем script на http-wrapper.js, так как мы его переименовали
    script: "http-wrapper.js", 
    cwd: "/app",
    
    instances: 1,
    exec_mode: "fork",
    
    autorestart: true,
    watch: false,
    
    // Лимиты памяти под тариф Pro (с небольшим запасом)
    max_memory_restart: '400M', 
    
    // Защита от цикличных перезагрузок
    exp_backoff_restart_delay: 2000, 
    min_uptime: "15s",
    
    // Даем время на сохранение базы данных при выключении
    kill_timeout: 5000, 
    
    // Мы убираем wait_ready: true, если в самом коде http-wrapper.js 
    // нет команды process.send('ready'). Иначе PM2 будет считать запуск вечно "pending".
    wait_ready: false, 

    env: {
      NODE_ENV: "production",
      PORT: 3000
    },

    // Логирование
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "logs/err.log",
    out_file: "logs/out.log",

    // Оптимизация движка V8
    node_args: [
      "--no-warnings",
      "--max-old-space-size=350" 
    ]
  }]
}
