module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, 
    autorestart: true,
    watch: false,
    max_memory_restart: '450M', // Увеличил запас памяти для работы с SQLite
    
    // Плавный перезапуск при сбоях (экспоненциальная задержка)
    exp_backoff_restart_delay: 500, 
    min_uptime: "10s",
    
    // ВАЖНО: Даем 8 секунд на выполнение flushToDisk() при выключении
    // Это критично для сохранения баланса игроков в базу данных
    kill_timeout: 8000, 
    
    // ОТКЛЮЧЕНО: так как в server.js нет сигнала готовности
    wait_ready: false, 

    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // ЛОГИРОВАНИЕ: На Bothost (Docker) логи должны идти в стандартный поток,
    // чтобы отображаться во вкладке «Логи работы» в панели управления.
    error_file: "/dev/stderr",
    out_file: "/dev/stdout",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true
  }]
}
