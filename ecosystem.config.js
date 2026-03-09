module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, // Оставляем 1, чтобы SQLite не заблокировался (Lock)
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    
    // Лимит памяти чуть ниже лимита тарифа (обычно 512MB), чтобы PM2 успел среагировать
    max_memory_restart: '400M', 
    
    // Стратегия перезапуска: если бот упадет, он подождет 2с, потом 4с и т.д.
    exp_backoff_restart_delay: 2000, 
    min_uptime: "15s",
    
    // Важно: время на выполнение функций shutdown (закрытие БД)
    kill_timeout: 5000, 
    
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // Отключаем запись в файлы внутри контейнера, 
    // чтобы логи пробрасывались напрямую в консоль/панель Bothost
    error_file: "/dev/stderr",
    out_file: "/dev/stdout",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    
    // Оставляем только отключение ворнингов
    node_args: "--no-warnings"
  }]
}
