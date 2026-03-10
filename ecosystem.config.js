module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "server.js", // Упростил путь, так как мы запускаем из корня /app
    cwd: "/app",         // Явно задаем рабочую директорию для Docker
    
    // Режим fork оптимален для 1 инстанса на лимитированных ресурсах
    instances: 1,
    exec_mode: "fork",
    
    autorestart: true,
    watch: false,
    
    // Перезапуск при превышении порога памяти (350MB V8 + запас)
    max_memory_restart: '400M', 
    
    // Стратегия предотвращения бесконечных рестартов при фатальных ошибках
    exp_backoff_restart_delay: 2000, 
    min_uptime: "15s",
    max_restarts: 10,
    
    // Грейсфул шатдаун: даем 5 секунд на сохранение users.json
    kill_timeout: 5000, 
    shutdown_with_message: true,
    
    // Ждем process.send('ready') от сервера перед тем, как считать запуск успешным
    wait_ready: true, 
    listen_timeout: 5000, // Увеличил до 5с, чтобы база точно успела прочитаться

    // Не перезапускать, если процесс завершился без ошибок
    stop_exit_codes: [0],

    env: {
      NODE_ENV: "production",
      PORT: 3000
    },

    // Настройка логов
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    error_file: "logs/err.log",
    out_file: "logs/out.log",

    // Оптимизация Node.js под тариф Pro
    node_args: [
      "--no-warnings",
      "--enable-source-maps",
      "--max-old-space-size=350" 
    ]
  }]
}
