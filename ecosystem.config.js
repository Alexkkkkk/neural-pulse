module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    
    // Для SQLite строго 1 инстанс и режим fork, чтобы избежать Lock-ошибок
    instances: 1,
    exec_mode: "fork",
    
    autorestart: true,
    watch: false,
    
    // Лимит памяти. На тарифе Pro у тебя есть запас, но 400M — безопасная отсечка
    max_memory_restart: '400M', 
    
    // Стратегия перезапуска: при падении ждем 2с, увеличивая интервал при повторных сбоях
    exp_backoff_restart_delay: 2000, 
    min_uptime: "15s",
    
    // Даем 5 секунд на корректное закрытие БД (вызов shutdown в твоем коде)
    kill_timeout: 5000, 
    
    // Переменные окружения
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // Логирование: перенаправляем всё в системные потоки Docker
    // Это позволяет Bothost корректно отображать логи в своей панели
    error_file: "/dev/stderr",
    out_file: "/dev/stdout",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    
    // Аргументы Node.js
    // --no-warnings убирает лишний шум в консоли
    // --enable-source-maps поможет, если будешь использовать минификацию
    node_args: [
      "--no-warnings",
      "--enable-source-maps"
    ],

    // Слушать сигналы остановки от Docker/Tini
    listen_timeout: 3000,
    shutdown_with_message: true
  }]
}
