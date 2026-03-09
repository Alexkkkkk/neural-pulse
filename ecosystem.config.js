
module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, 
    autorestart: true,
    watch: false,
    
    // Лимит памяти: если Node.js превысит этот порог, PM2 мягко перезапустит процесс.
    // Это защищает сервер от падения при утечках.
    max_memory_restart: '450M', 
    
    // Плавный перезапуск при сбоях (экспоненциальная задержка)
    // Предотвращает "бесконечный рестарт", если что-то сломалось серьезно.
    exp_backoff_restart_delay: 500, 
    min_uptime: "10s",
    
    // ВАЖНО: Время на сохранение данных при выключении (в мс).
    // Даем серверу 8 секунд на выполнение flushToDisk() в базе данных.
    kill_timeout: 8000, 
    
    // Отключаем ожидание сигнала "ready", так как в коде сервера его нет.
    wait_ready: false, 

    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // ЛОГИРОВАНИЕ: Перенаправляем логи в стандартные потоки Docker.
    // Это позволяет видеть все события во вкладке «Логи работы» на Bothost.
    error_file: "/dev/stderr",
    out_file: "/dev/stdout",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    
    // Отключаем перезагрузку при изменении самого файла конфигурации
    node_args: "--no-warnings"
  }]
}
