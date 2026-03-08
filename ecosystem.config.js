module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js",
    instances: 1, // Для SQLite лучше оставить 1, чтобы избежать блокировок БД
    autorestart: true,
    watch: false, // На продакшене лучше false
    max_memory_restart: '300M',
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    // Настройки для предотвращения частых рестартов при критических ошибках
    exp_backoff_restart_delay: 100
  }]
}
