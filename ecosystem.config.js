module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js", 
    instances: 1, 
    autorestart: true,
    watch: false,
    
    // Лимит памяти: PM2 перезапустит процесс, если он превысит 450МБ
    max_memory_restart: '450M', 
    
    // Плавный перезапуск при сбоях (экспоненциальная задержка)
    exp_backoff_restart_delay: 1000, 
    min_uptime: "15s",
    
    // ВАЖНО: Время на сохранение данных при выключении (в мс).
    // Увеличено до 10 секунд, чтобы flushToDisk точно успел завершиться.
    kill_timeout: 10000, 
    
    // Отключаем ожидание сигнала "ready"
    wait_ready: false, 

    // Настройки окружения
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // ЛОГИРОВАНИЕ: Настраиваем вывод так, чтобы он был доступен и в Docker, и в файлах
    // Мы используем пути, которые подготовили в Dockerfile
    error_file: "./logs/error.log",
    out_file: "./logs/combined.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true,
    
    // Аргументы Node.js:
    // --max-old-space-size: ограничиваем кучу (heap), чтобы не вылететь по OOM в Docker
    node_args: "--max-old-space-size=400 --no-warnings"
  }]
}
