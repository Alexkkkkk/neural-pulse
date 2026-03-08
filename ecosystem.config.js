module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js",
    instances: 1, 
    autorestart: true,
    watch: false,
    max_memory_restart: '350M',
    
    // Плавный перезапуск при сбоях (чтобы не спамить рестартами)
    exp_backoff_restart_delay: 100, 
    min_uptime: "10s",
    
    // Даем 5 секунд на выполнение flushToDisk() при выключении
    kill_timeout: 5000, 
    wait_ready: true,
    listen_timeout: 3000,

    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // Логирование (убедись, что папка logs существует)
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true
  }]
}
