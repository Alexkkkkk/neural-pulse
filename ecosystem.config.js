module.exports = {
  apps: [{
    name: "neural-pulse-core",
    script: "./server.js",
    instances: 1, // Для SQLite оставляем 1, чтобы не было конфликтов записи
    autorestart: true,
    watch: false,
    max_memory_restart: '350M', // Авто-рестарт при превышении 350МБ RAM
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true
  }]
}
