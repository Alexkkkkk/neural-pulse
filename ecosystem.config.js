module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    
    // Оставляем fork для экономии ресурсов на тарифе Pro
    instances: 1,
    exec_mode: "fork",
    
    autorestart: true,
    watch: false,
    
    // Мониторинг памяти
    max_memory_restart: '400M', 
    
    // Защита от цикличных перезагрузок (Crash Loop)
    exp_backoff_restart_delay: 2000, 
    min_uptime: "15s",
    max_restarts: 10,
    
    // Механизм корректного завершения (Graceful Shutdown)
    // Эти настройки критичны, чтобы успеть сохранить users.json
    kill_timeout: 5000, 
    shutdown_with_message: true,
    wait_ready: true, 
    listen_timeout: 3000,

    // Коды выхода, при которых НЕ нужно перезапускаться (чистое завершение)
    stop_exit_codes: [0],

    env: {
      NODE_ENV: "production",
      PORT: 3000
    },

    // Пути к логам внутри Docker-контейнера
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    error_file: "logs/err.log",
    out_file: "logs/out.log",

    // Тюнинг движка V8 под лимиты хостинга
    node_args: [
      "--no-warnings",
      "--enable-source-maps",
      "--max-old-space-size=350" 
    ]
  }]
}
